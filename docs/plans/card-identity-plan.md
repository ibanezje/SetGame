# Card Identity & Multiplayer Sync Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix duplicate/stale cards in multiplayer SET by giving every card a unique ID and using IDs throughout the protocol and UI.

**Architecture:** Add deterministic `id` field to cards at deck creation. Replace all index-based references (socket events, React keys, selection state) with ID-based references. Server removes/looks up cards by ID. Client flashes removed cards before replacing the board.

**Tech Stack:** Node.js, Socket.IO, React, `node:test` (built-in test runner)

**Spec:** `docs/card-identity-design.md`

---

## File Map

| File | Role | Action |
|------|------|--------|
| `server/gameLogic.js` | Pure game logic (deck, validation, dealing) | Modify: add `id` to cards in `createDeck()` |
| `server/gameLogic.test.js` | Tests for game logic + multiplayer sync | Create |
| `server/server.js` | Socket.IO server, room management | Modify: ID-based `submit_set`, `set_valid`, `set_invalid`, `hint_card` |
| `client/src/App.jsx` | Client socket event handlers, state management | Modify: ID-based event handlers, delayed board update |
| `client/src/pages/Game.jsx` | Game UI, card grid, selection | Modify: `key={card.id}`, ID-based selection |

---

### Task 1: Add card IDs to `createDeck()` + tests

**Files:**
- Modify: `server/gameLogic.js:12-25`
- Create: `server/gameLogic.test.js`

- [ ] **Step 1: Add `test` script to `server/package.json`**

In `server/package.json`, add the test script:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "test": "node --test gameLogic.test.js"
}
```

- [ ] **Step 2: Write failing tests for card IDs and game rules**

Create `server/gameLogic.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createDeck, isValidSet, findAllSets, dealCards, refillAfterSet } = require('./gameLogic');

describe('createDeck', () => {
  it('produces exactly 81 cards', () => {
    const deck = createDeck();
    assert.equal(deck.length, 81);
  });

  it('every card has a unique id', () => {
    const deck = createDeck();
    const ids = deck.map(c => c.id);
    assert.equal(new Set(ids).size, 81);
  });

  it('card id matches its properties', () => {
    const deck = createDeck();
    for (const card of deck) {
      assert.equal(card.id, `${card.number}-${card.color}-${card.shape}-${card.shading}`);
    }
  });
});

describe('isValidSet', () => {
  it('accepts a valid SET (all different on every property)', () => {
    const a = { id: '1-red-oval-solid',       number: 1, color: 'red',    shape: 'oval',     shading: 'solid' };
    const b = { id: '2-green-diamond-striped', number: 2, color: 'green',  shape: 'diamond',  shading: 'striped' };
    const c = { id: '3-purple-squiggle-open',  number: 3, color: 'purple', shape: 'squiggle', shading: 'open' };
    assert.equal(isValidSet(a, b, c), true);
  });

  it('accepts a valid SET (all same color, all different rest)', () => {
    const a = { id: '1-red-oval-solid',      number: 1, color: 'red', shape: 'oval',     shading: 'solid' };
    const b = { id: '2-red-diamond-striped',  number: 2, color: 'red', shape: 'diamond',  shading: 'striped' };
    const c = { id: '3-red-squiggle-open',    number: 3, color: 'red', shape: 'squiggle', shading: 'open' };
    assert.equal(isValidSet(a, b, c), true);
  });

  it('rejects an invalid SET (two same, one different on a property)', () => {
    const a = { id: '1-red-oval-solid',      number: 1, color: 'red',   shape: 'oval',    shading: 'solid' };
    const b = { id: '2-red-diamond-striped',  number: 2, color: 'red',   shape: 'diamond', shading: 'striped' };
    const c = { id: '3-green-squiggle-open',  number: 3, color: 'green', shape: 'squiggle', shading: 'open' };
    assert.equal(isValidSet(a, b, c), false);
  });

  it('returns false for null/undefined cards', () => {
    assert.equal(isValidSet(null, null, null), false);
    assert.equal(isValidSet(undefined, { number: 1, color: 'red', shape: 'oval', shading: 'solid' }, null), false);
  });
});

describe('findAllSets', () => {
  it('finds SETs on a known board', () => {
    const board = [
      { id: '1-red-oval-solid',       number: 1, color: 'red',    shape: 'oval',     shading: 'solid' },
      { id: '2-green-diamond-striped', number: 2, color: 'green',  shape: 'diamond',  shading: 'striped' },
      { id: '3-purple-squiggle-open',  number: 3, color: 'purple', shape: 'squiggle', shading: 'open' },
      { id: '1-green-oval-solid',      number: 1, color: 'green',  shape: 'oval',     shading: 'solid' },
    ];
    const sets = findAllSets(board);
    assert.equal(sets.length, 1);
    assert.deepEqual(sets[0], [0, 1, 2]);
  });

  it('returns empty when no SET exists', () => {
    const board = [
      { id: '1-red-oval-solid',    number: 1, color: 'red',   shape: 'oval',    shading: 'solid' },
      { id: '1-red-oval-striped',  number: 1, color: 'red',   shape: 'oval',    shading: 'striped' },
      { id: '1-red-oval-open',     number: 1, color: 'red',   shape: 'oval',    shading: 'open' },
      { id: '1-green-oval-solid',  number: 1, color: 'green', shape: 'oval',    shading: 'solid' },
    ];
    // first three form a valid set on number/color/shape (all same) and shading (all different) — actually that IS a set
    // Let me pick cards that truly have no set:
    const board2 = [
      { id: '1-red-oval-solid',      number: 1, color: 'red',    shape: 'oval',    shading: 'solid' },
      { id: '2-red-oval-solid',      number: 2, color: 'red',    shape: 'oval',    shading: 'solid' },
      { id: '1-green-diamond-solid', number: 1, color: 'green',  shape: 'diamond', shading: 'solid' },
    ];
    const sets = findAllSets(board2);
    assert.equal(sets.length, 0);
  });
});

describe('dealCards', () => {
  it('fills board to 12 cards', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);
    assert.ok(board.length >= 12);
    assert.equal(deck.length, 81 - board.length);
  });

  it('expands board by 3 if no SET at 12', () => {
    // We can't easily construct a no-SET-at-12 deck deterministically,
    // but we can verify the invariant: after dealCards, a SET must exist (or deck is empty)
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);
    if (deck.length > 0) {
      assert.ok(findAllSets(board).length > 0, 'Board must contain a SET after dealing');
    }
  });

  it('all dealt cards have unique IDs', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);
    const ids = board.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length, 'Board must not contain duplicate IDs');
  });
});

describe('refillAfterSet', () => {
  it('refills board to 12 after removal from 12-card board', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);

    const sets = findAllSets(board);
    if (sets.length === 0) return; // skip if no set (shouldn't happen)

    const [i, j, k] = sets[0];
    const removedIds = [board[i].id, board[j].id, board[k].id];
    // Remove by ID
    const boardSizeBefore = board.length;
    const remaining = board.filter(c => !removedIds.includes(c.id));
    board.length = 0;
    remaining.forEach(c => board.push(c));

    refillAfterSet(deck, board, boardSizeBefore);
    assert.ok(board.length >= 12 || deck.length === 0);
  });

  it('no duplicate IDs after refill', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);

    const sets = findAllSets(board);
    if (sets.length === 0) return;

    const [i, j, k] = sets[0];
    const removedIds = [board[i].id, board[j].id, board[k].id];
    const boardSizeBefore = board.length;
    const remaining = board.filter(c => !removedIds.includes(c.id));
    board.length = 0;
    remaining.forEach(c => board.push(c));

    refillAfterSet(deck, board, boardSizeBefore);

    const ids = board.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length, 'No duplicate IDs after refill');
  });
});
```

- [ ] **Step 3: Run tests — expect failures on card ID tests**

Run: `cd server && npm test`
Expected: `createDeck` ID tests fail (cards don't have `id` field yet). `isValidSet` and `findAllSets` tests should pass.

- [ ] **Step 4: Add `id` field to `createDeck()`**

In `server/gameLogic.js`, change the `createDeck` function (lines 12-25):

```js
function createDeck() {
  const deck = [];
  for (const number of NUMBERS)
    for (const color of COLORS)
      for (const shape of SHAPES)
        for (const shading of SHADINGS)
          deck.push({ id: `${number}-${color}-${shape}-${shading}`, number, color, shape, shading });

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
```

- [ ] **Step 5: Run tests — all should pass**

Run: `cd server && npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/gameLogic.js server/gameLogic.test.js server/package.json
git commit -m "feat: add deterministic card IDs to createDeck and game rule tests"
```

---

### Task 2: Multiplayer sync tests (remove-by-ID + full game simulation)

**Files:**
- Modify: `server/gameLogic.test.js`

- [ ] **Step 1: Add multiplayer sync tests**

Append to `server/gameLogic.test.js`:

```js
describe('multiplayer sync: remove by ID and refill', () => {
  it('removed card IDs never reappear on board after refill', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);

    const sets = findAllSets(board);
    if (sets.length === 0) return;

    const [i, j, k] = sets[0];
    const removedIds = [board[i].id, board[j].id, board[k].id];
    const boardSizeBefore = board.length;
    const remaining = board.filter(c => !removedIds.includes(c.id));
    board.length = 0;
    remaining.forEach(c => board.push(c));

    refillAfterSet(deck, board, boardSizeBefore);

    for (const card of board) {
      assert.ok(!removedIds.includes(card.id), `Removed card ${card.id} should not reappear`);
    }
  });

  it('full game simulation: board integrity at every step', () => {
    const deck = createDeck();
    const board = [];
    const allRemovedIds = [];

    dealCards(deck, board);

    let rounds = 0;
    while (true) {
      // Verify: no duplicate IDs on board
      const boardIds = board.map(c => c.id);
      assert.equal(new Set(boardIds).size, boardIds.length, `Round ${rounds}: duplicate IDs on board`);

      // Verify: no removed card reappeared
      for (const id of boardIds) {
        assert.ok(!allRemovedIds.includes(id), `Round ${rounds}: removed card ${id} reappeared`);
      }

      const sets = findAllSets(board);
      if (sets.length === 0) break;

      const [i, j, k] = sets[0];
      const removedIds = [board[i].id, board[j].id, board[k].id];
      allRemovedIds.push(...removedIds);

      const boardSizeBefore = board.length;
      const remaining = board.filter(c => !removedIds.includes(c.id));
      board.length = 0;
      remaining.forEach(c => board.push(c));

      refillAfterSet(deck, board, boardSizeBefore);
      rounds++;
    }

    // Game ended — all removed cards + remaining board = subset of original 81
    const totalAccountedFor = allRemovedIds.length + board.length + deck.length;
    assert.equal(totalAccountedFor, 81, 'All 81 cards accounted for');
  });

  it('looking up a card ID not on the board returns undefined', () => {
    const deck = createDeck();
    const board = [];
    dealCards(deck, board);

    const fakeId = '9-pink-star-dotted';
    const found = board.find(c => c.id === fakeId);
    assert.equal(found, undefined);
  });
});
```

- [ ] **Step 2: Run tests — all should pass**

Run: `cd server && npm test`
Expected: All tests pass (cards already have IDs from Task 1).

- [ ] **Step 3: Commit**

```bash
git add server/gameLogic.test.js
git commit -m "test: add multiplayer sync tests — remove by ID, full game simulation"
```

---

### Task 3: Update server `submit_set` handler to use card IDs

**Files:**
- Modify: `server/server.js:194-240`

- [ ] **Step 1: Update `submit_set` to accept `cardIds` and look up by ID**

In `server/server.js`, replace the `submit_set` handler (lines 194-240):

```js
  socket.on('submit_set', ({ cardIds }) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;
    if (room.claimingPlayerId !== socket.id) return;
    if (!Array.isArray(cardIds) || cardIds.length !== 3) return;

    clearClaim(room);

    const player = room.players.find(p => p.id === socket.id);
    const cards = cardIds.map(id => room.board.find(c => c.id === id));

    // Stale submission — card no longer on board
    if (cards.some(c => !c)) return;

    if (isValidSet(...cards)) {
      player.score += 10;

      const boardSizeBefore = room.board.length;
      room.board = room.board.filter(c => !cardIds.includes(c.id));
      const extra = refillAfterSet(room.deck, room.board, boardSizeBefore);

      const hasMoreSets = findAllSets(room.board).length > 0;
      const deckEmpty   = room.deck.length === 0;

      if (deckEmpty && !hasMoreSets) {
        room.state = 'finished';
        clearHintTimer(room);
        io.to(room.code).emit('game_over', { players: room.players });
      } else {
        io.to(room.code).emit('set_valid', {
          removedCardIds: cardIds,
          players: room.players,
          board: room.board,
          deckSize: room.deck.length,
          boardExpanded: extra
        });
        startHintTimer(room);
      }
    } else {
      if (room.settings.penaltyEnabled) player.score -= 5;
      io.to(room.code).emit('set_invalid', {
        cardIds,
        players: room.players,
        penaltyApplied: room.settings.penaltyEnabled
      });
      startHintTimer(room);
    }
  });
```

- [ ] **Step 2: Update `hint_card` emission to send `cardId`**

In `server/server.js`, in the `startHintTimer` function (line 80), change:

```js
    io.to(room.code).emit('hint_card', { cardId: room.board[sets[0][0]].id });
```

- [ ] **Step 3: Run server tests to verify nothing broke**

Run: `cd server && npm test`
Expected: All tests pass (tests don't touch server.js directly).

- [ ] **Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: server uses card IDs for submit_set, set_valid, set_invalid, hint_card"
```

---

### Task 4: Update client `App.jsx` — ID-based event handlers + delayed board update

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace `hintCardIndex` with `hintCardId`**

In `client/src/App.jsx`, change line 12:

```js
  const [hintCardId,    setHintCardId]    = useState(null);
```

Add a ref for the pending board update after line 17:

```js
  const pendingBoard = useRef(null);
```

- [ ] **Step 2: Update `set_valid` handler for delayed board update**

Replace the `set_valid` handler (lines 88-95):

```js
    socket.on('set_valid', ({ removedCardIds, players, board, deckSize, boardExpanded }) => {
      // Flash removed cards on current board, then swap to new board after delay
      setRoom(prev => prev ? { ...prev, players, deckSize, claimingPlayerId: null } : prev);
      setHintCardId(null);

      // Store the new board for delayed swap
      pendingBoard.current = board;

      // Flash the removed cards by ID
      setNotification(prev => ({ ...prev, flashIndices: { ids: removedCardIds, type: 'valid' } }));

      // After flash duration, swap in the new board
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        setRoom(prev => prev ? { ...prev, board: pendingBoard.current } : prev);
        pendingBoard.current = null;
        setNotification(prev => prev ? { ...prev, flashIndices: null } : null);
      }, 800);

      if (boardExpanded > 0) {
        setTimeout(() => showNotification(`No SET at 12 — ${boardExpanded} more cards dealt!`, 'warning'), 900);
      }
    });
```

- [ ] **Step 3: Update `set_invalid` handler to use card IDs**

Replace the `set_invalid` handler (lines 97-105):

```js
    socket.on('set_invalid', ({ cardIds, players, penaltyApplied }) => {
      setRoom(prev => prev ? { ...prev, players, claimingPlayerId: null } : prev);
      setNotification(prev => ({ ...prev, flashIndices: { ids: cardIds, type: 'invalid' } }));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setNotification(prev => prev ? { ...prev, flashIndices: null } : null), 800);
      if (penaltyApplied) {
        showNotification('\u2717 Not a SET  (\u22125 pts)', 'error');
      } else {
        showNotification('\u2717 Not a SET', 'error');
      }
    });
```

- [ ] **Step 4: Update `hint_card` handler**

Replace the `hint_card` handler (lines 107-109):

```js
    socket.on('hint_card', ({ cardId }) => {
      setHintCardId(cardId);
    });
```

- [ ] **Step 5: Update all `hintCardIndex` references to `hintCardId`**

In the `game_started` handler (line 62), `room_updated` handler (line 55), and `game_over` handler (line 113):

Change `setHintCardIndex(null)` to `setHintCardId(null)` in all three places.

In the `triggerFlash` function (lines 25-29), remove it entirely — its logic is now inline in the `set_valid` and `set_invalid` handlers.

In the Game component render (line 211), change the prop:

```jsx
          hintCardId={hintCardId}
```

- [ ] **Step 6: Update `handleSubmitSet` to send card IDs**

Replace line 149-151:

```js
  function handleSubmitSet(cardIds) {
    socket.emit('submit_set', { cardIds });
  }
```

- [ ] **Step 7: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: client uses card IDs for events, delayed board swap on set_valid"
```

---

### Task 5: Update `Game.jsx` — ID-based keys and selection

**Files:**
- Modify: `client/src/pages/Game.jsx`

- [ ] **Step 1: Change selection state from indices to card IDs**

The `selected` state already stores values — change from indices to card IDs. In `toggleCard` (lines 61-68):

```js
  function toggleCard(cardId) {
    if (!isClaiming) return;
    setSelected(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : prev.length < 3 ? [...prev, cardId] : prev
    );
  }
```

- [ ] **Step 2: Update auto-submit to send card IDs**

The `useEffect` at lines 55-59 already sends `selected` to `onSubmitSet` — since `selected` now contains card IDs, this works without change. Verify the code reads:

```js
  useEffect(() => {
    if (isClaiming && selected.length === 3) {
      onSubmitSet(selected);
    }
  }, [selected, isClaiming, onSubmitSet]);
```

No change needed — `selected` is now card IDs, and `onSubmitSet` sends `{ cardIds }`.

- [ ] **Step 3: Update prop name from `hintCardIndex` to `hintCardId`**

In the component props (line 11):

```js
  hintCardId,         // card ID to subtly highlight, or null
```

- [ ] **Step 4: Update card grid to use `card.id` for keys and ID-based matching**

Replace the card grid rendering (lines 146-165):

```jsx
      <div className="card-grid" style={{ '--cols': board.length > 12 ? 4 : 3 }}>
        {board.map((card) => {
          const isSelected    = selected.includes(card.id);
          const isHighlighted = notification?.flashIndices?.type === 'valid'   && notification?.flashIndices?.ids?.includes(card.id);
          const isInvalid     = notification?.flashIndices?.type === 'invalid' && notification?.flashIndices?.ids?.includes(card.id);
          const isHint        = hintCardId === card.id && !isSelected && !claimingPlayerId;
          const isDisabled    = !isClaiming;

          return (
            <div key={card.id} className={`card-cell ${isHint ? 'card-hint' : ''}`}>
              <Card
                card={card}
                selected={isSelected}
                highlighted={isHighlighted}
                invalid={isInvalid}
                onClick={() => toggleCard(card.id)}
                disabled={isDisabled}
              />
            </div>
          );
        })}
      </div>
```

Key changes:
- `key={card.id}` instead of `key={idx}`
- `selected.includes(card.id)` instead of `selected.includes(idx)`
- `notification?.flashIndices?.ids?.includes(card.id)` instead of `notification?.flashIndices?.indices?.includes(idx)`
- `hintCardId === card.id` instead of `hintCardIndex === idx`
- `toggleCard(card.id)` instead of `toggleCard(idx)`

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Game.jsx
git commit -m "feat: Game.jsx uses card IDs for keys, selection, and flash matching"
```

---

### Task 6: End-to-end smoke test

**Files:** None (manual verification)

- [ ] **Step 1: Run all server tests**

Run: `cd server && npm test`
Expected: All tests pass.

- [ ] **Step 2: Verify no lint/syntax errors in client**

Run: `cd client && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit build verification (if any fixes needed)**

If fixes were needed, commit them. Otherwise, skip.
