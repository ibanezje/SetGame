# Card Identity & Multiplayer Sync Fix

## Problem

The multiplayer SET game has two related bugs:

1. **Duplicate/stale cards shown after a SET is found.** The server sends a new `board` array alongside the old positional `indices` in `set_valid`. Clients flash the wrong positions and React, using `key={idx}`, can't tell old cards from new ones.
2. **Not all players see updated cards.** Because the client merges board state via index-based positional updates, any timing difference between players causes divergent views.

Root cause: cards have no stable identity. Everything is referenced by array position, which shifts on every removal/refill.

## Approach

Give every card a deterministic unique ID. Use IDs instead of indices in the socket protocol, in React keys, and in client selection state.

## Design

### 1. Card Identity

Each card gets an `id` field at deck creation time in `createDeck()`:

```
id = `${number}-${color}-${shape}-${shading}`
```

Example: `"1-red-oval-solid"`, `"3-purple-diamond-striped"`.

Deterministic, not random — makes tests reproducible without mocking. Guaranteed unique because the 81-card SET deck has exactly one card per property combination.

### 2. Protocol Changes

#### `submit_set` (client -> server)

Before: `{ indices: [0, 4, 7] }`
After: `{ cardIds: ["1-red-oval-solid", "2-green-diamond-open", "3-purple-squiggle-striped"] }`

Server looks up cards by ID in `room.board`, not by array position.

#### `set_valid` (server -> client)

Before: `{ indices, players, board, deckSize, boardExpanded }`
After: `{ removedCardIds, players, board, deckSize, boardExpanded }`

Client uses `removedCardIds` to flash the correct cards before updating the board.

#### `set_invalid` (server -> client)

Before: `{ indices, players, penaltyApplied }`
After: `{ cardIds, players, penaltyApplied }`

Client flashes by matching IDs on the current board.

#### `hint_card` (server -> client)

Before: `{ cardIndex: 0 }`
After: `{ cardId: "1-red-oval-solid" }`

Client finds the card by ID on its board.

#### Unchanged events

`game_started`, `room_updated`, `set_claimed`, `claim_timeout`, `claim_cancelled`, `game_over` — these either already send the full board or don't reference individual cards.

### 3. Server-side Card Lookup

The `submit_set` handler changes from index-based lookup:

```js
// Before
const [i, j, k] = indices;
const cards = [room.board[i], room.board[j], room.board[k]];
```

To ID-based lookup:

```js
// After
const cards = cardIds.map(id => room.board.find(c => c.id === id));
if (cards.some(c => !c)) return; // stale submission, ignore
```

Removal changes from descending-index splice to filter:

```js
// Before
const sorted = [i, j, k].sort((a, b) => b - a);
sorted.forEach(idx => room.board.splice(idx, 1));

// After
room.board = room.board.filter(c => !cardIds.includes(c.id));
```

`refillAfterSet` and `dealCards` in `gameLogic.js` need no changes — they push from deck, and cards already carry IDs from creation.

### 4. Client Rendering Changes

**React keys:** `Game.jsx` changes from `key={idx}` to `key={card.id}`. React correctly tracks card identity across board updates.

**Selection state:** `selected` stores card IDs instead of positional indices. `toggleCard` receives `card.id`. Auto-submit at 3 sends card IDs directly.

**Flash/highlight logic:** Matches by card ID instead of index:
- `set_valid` -> store `removedCardIds`, flash cards whose `card.id` is in that set
- `set_invalid` -> same pattern with `cardIds`
- Hint -> store `hintCardId` instead of `hintCardIndex`, match by `card.id`

**Flash timing for `set_valid`:** The board update is delayed so the flash is visible on the old cards before they disappear:
1. Receive `set_valid` with `removedCardIds` + new `board`
2. Store the new board in a ref (not state yet). Flash the removed cards on the current board.
3. After 800ms (matching the existing `flashTimer` duration), replace board state with the stored new board and clear the flash.

This keeps the existing 800ms flash duration and ensures the user sees which cards were removed before the board updates. During the flash window, claims are blocked server-side (claim just ended), so no new events will conflict.

### 5. Test Cases

New file `server/gameLogic.test.js` using Node's built-in `node:test` runner (zero dependencies).

#### Game rules tests

- `createDeck()` produces exactly 81 cards, all with unique IDs
- `isValidSet()` accepts a valid SET (all-same or all-different per property)
- `isValidSet()` rejects an invalid SET (two-same-one-different on any property)
- `findAllSets()` finds all SETs on a known board configuration
- `findAllSets()` returns empty array when no SET exists
- `dealCards()` fills board to 12, expands by 3 if no SET present
- `refillAfterSet()` refills to 12 when board was at 12, expands if needed

#### Multiplayer sync tests (simulated, no real sockets)

- Cards on board have unique IDs after any operation
- After removing a SET by ID and refilling, no removed card ID reappears on the board
- After removing a SET by ID and refilling, board contains no duplicate IDs
- Submitting a card ID not on the board is handled gracefully (stale submission)
- Full game simulation: repeatedly find a SET, remove by ID, refill, assert board integrity (no duplicates, all IDs from original deck) at every step until deck is exhausted

## Files Changed

| File | Change |
|------|--------|
| `server/gameLogic.js` | Add `id` field in `createDeck()` |
| `server/server.js` | Update `submit_set` handler to use card IDs; update `set_valid`/`set_invalid`/`hint_card` emissions |
| `client/src/App.jsx` | Update event handlers to use card IDs; add delayed board update for `set_valid` flash |
| `client/src/pages/Game.jsx` | Use `card.id` for keys and selection state |
| `server/gameLogic.test.js` | New file — game rules + multiplayer sync tests |
