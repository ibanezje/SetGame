# Flash Duration, Game-End Display & Card Slide Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the green flash duration and card slide duration configurable in the lobby, show the final SET flashing green before the results screen, and animate cards sliding to their new grid positions after a SET is removed.

**Architecture:** All timing is client-driven. The server adds two new settings (`flashDuration`, `slideDuration`) and passes `removedCardIds` through `game_over`. The client's `App.jsx` uses a `settingsRef` to read current settings inside stale socket closures. The FLIP animation lives entirely in `Game.jsx` using `useLayoutEffect` and per-card DOM refs.

**Tech Stack:** Node.js/Express/Socket.io (server), React 18 + Vite (client), plain CSS keyframes (wiggle)

**Spec:** `docs/superpowers/specs/2026-04-05-flash-slide-animation-design.md`

---

## File Map

| File | What changes |
|---|---|
| `server/server.js` | Add `flashDuration`/`slideDuration` to `makeRoom` + `update_settings`; pass `removedCardIds` in natural `game_over` |
| `client/src/pages/Lobby.jsx` | Two new sliders (flash, slide) for host; two new read-only lines for non-host |
| `client/src/App.jsx` | Add `settingsRef`; use `flashDuration` in `set_valid` timer; delayed nav + toast in `game_over` |
| `client/src/pages/Game.jsx` | FLIP animation via `cardRefs` + `prevPositionsRef` + `useLayoutEffect` |
| `client/src/index.css` | `@keyframes card-wiggle` + `.card-new` rule |

---

## Task 1 — Server: add `flashDuration` and `slideDuration` settings

**Files:**
- Modify: `server/server.js`

- [ ] **Step 1: Add defaults to `makeRoom`**

In `makeRoom` (around line 33), extend the `settings` object:

```js
settings: {
  thinkingTime: 10,
  penaltyEnabled: true,
  hintDelay: 20,
  flashDuration: 3,   // seconds — green flash after a valid SET
  slideDuration: 1    // seconds — card slide animation after board swap
},
```

- [ ] **Step 2: Accept and clamp both settings in `update_settings`**

In the `update_settings` handler (around line 124), add two lines after the existing clamping:

```js
if (typeof flashDuration === 'number') room.settings.flashDuration = Math.min(5,   Math.max(1,   flashDuration));
if (typeof slideDuration  === 'number') room.settings.slideDuration  = Math.min(3,   Math.max(0.2, slideDuration));
```

The full `update_settings` block becomes:

```js
socket.on('update_settings', ({ thinkingTime, penaltyEnabled, hintDelay, flashDuration, slideDuration }) => {
  const room = findRoomBySocket(socket.id);
  if (!room) return;
  const player = room.players.find(p => p.id === socket.id);
  if (!player?.isHost) return;
  if (typeof thinkingTime    === 'number') room.settings.thinkingTime   = Math.min(60,  Math.max(3,   thinkingTime));
  if (typeof penaltyEnabled  === 'boolean') room.settings.penaltyEnabled = penaltyEnabled;
  if (typeof hintDelay       === 'number') room.settings.hintDelay      = Math.min(120, Math.max(0,   hintDelay));
  if (typeof flashDuration   === 'number') room.settings.flashDuration  = Math.min(5,   Math.max(1,   flashDuration));
  if (typeof slideDuration   === 'number') room.settings.slideDuration  = Math.min(3,   Math.max(0.2, slideDuration));
  io.to(room.code).emit('room_updated', roomPublic(room));
});
```

- [ ] **Step 3: Verify manually**

Start the server (`cd server && node server.js`), connect two clients, create a room, and confirm the settings object in the `room_updated` event includes `flashDuration: 3` and `slideDuration: 1`. Use browser devtools Network → WS tab.

- [ ] **Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: add flashDuration and slideDuration to room settings"
```

---

## Task 2 — Server: pass `removedCardIds` in natural `game_over`

**Files:**
- Modify: `server/server.js`

- [ ] **Step 1: Update the `game_over` emit inside `submit_set`**

In `submit_set` (around line 218), the natural game-over branch currently emits:

```js
io.to(room.code).emit('game_over', { players: room.players });
```

Change it to:

```js
io.to(room.code).emit('game_over', { players: room.players, removedCardIds: cardIds });
```

The two other `game_over` emits (host ended, not enough players — around lines 269 and 310) must **not** include `removedCardIds`. Leave them unchanged.

- [ ] **Step 2: Commit**

```bash
git add server/server.js
git commit -m "feat: include removedCardIds in natural game_over event"
```

---

## Task 3 — Lobby: sliders for flashDuration and slideDuration

**Files:**
- Modify: `client/src/pages/Lobby.jsx`

- [ ] **Step 1: Add two sliders to the host settings panel**

After the existing `hintDelay` slider block (around line 99), add:

```jsx
<div className="setting-row">
  <label>Card flash</label>
  <div className="setting-control">
    <input
      type="range" min={1} max={5} step={0.5}
      value={room.settings.flashDuration}
      onChange={e => onUpdateSettings({ flashDuration: Number(e.target.value) })}
    />
    <span className="setting-value">{room.settings.flashDuration}s</span>
  </div>
</div>

<div className="setting-row">
  <label>Card slide</label>
  <div className="setting-control">
    <input
      type="range" min={0.2} max={3} step={0.1}
      value={room.settings.slideDuration}
      onChange={e => onUpdateSettings({ slideDuration: Number(e.target.value) })}
    />
    <span className="setting-value">{room.settings.slideDuration}s</span>
  </div>
</div>
```

- [ ] **Step 2: Add two lines to the read-only settings view**

After the existing `<p>Hint card: ...` line (around line 108), add:

```jsx
<p>Card flash: <strong>{room.settings.flashDuration}s</strong></p>
<p>Card slide: <strong>{room.settings.slideDuration}s</strong></p>
```

- [ ] **Step 3: Verify manually**

Run the client (`cd client && npm run dev`), create a room, confirm both sliders appear. Drag them and confirm `room_updated` events arrive with updated values in devtools.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Lobby.jsx
git commit -m "feat: add flashDuration and slideDuration sliders to lobby"
```

---

## Task 4 — App.jsx: settingsRef, updated set_valid timer, game_over flash

**Files:**
- Modify: `client/src/App.jsx`

**Background:** Socket handlers registered in the `useEffect([], [])` closure have stale access to React state. We use a `settingsRef` (a mutable ref updated whenever `room.settings` changes) to safely read the latest settings inside those handlers.

- [ ] **Step 1: Add `settingsRef` and keep it in sync**

Near the other refs (around line 17), add:

```js
const settingsRef = useRef({ thinkingTime: 10, penaltyEnabled: true, hintDelay: 20, flashDuration: 3, slideDuration: 1 });
```

After the `useEffect` that handles socket events, add a new `useEffect`:

```js
useEffect(() => {
  if (room?.settings) settingsRef.current = room.settings;
}, [room?.settings]);
```

- [ ] **Step 2: Use `settingsRef.flashDuration` in the `set_valid` handler**

In the `set_valid` socket handler (around line 83), replace the hardcoded `800` with `settingsRef.current.flashDuration * 1000` in both timeout calls:

```js
socket.on('set_valid', ({ removedCardIds, players, board, deckSize, boardExpanded }) => {
  setRoom(prev => prev ? { ...prev, players, deckSize, claimingPlayerId: null } : prev);
  setHintCardId(null);

  pendingBoard.current = board;

  setNotification(prev => ({ ...prev, flashIndices: { ids: removedCardIds, type: 'valid' } }));

  if (flashTimer.current) clearTimeout(flashTimer.current);
  flashTimer.current = setTimeout(() => {
    setRoom(prev => prev ? { ...prev, board: pendingBoard.current } : prev);
    pendingBoard.current = null;
    setNotification(prev => prev ? { ...prev, flashIndices: null } : null);
  }, settingsRef.current.flashDuration * 1000);

  if (boardExpanded > 0) {
    setTimeout(() => showNotification(`No SET at 12 — ${boardExpanded} more cards dealt!`, 'warning'), settingsRef.current.flashDuration * 1000 + 100);
  }
});
```

- [ ] **Step 3: Update `game_over` handler to flash the last SET**

Replace the existing `game_over` handler (around line 121) with:

```js
socket.on('game_over', ({ players, reason, removedCardIds }) => {
  setRoom(prev => prev ? { ...prev, players, state: 'finished', claimingPlayerId: null } : prev);
  setHintCardId(null);

  if (removedCardIds?.length) {
    // Natural end: flash the last SET green, then navigate to results
    const flashMs = settingsRef.current.flashDuration * 1000;
    setNotification({
      message: 'No more SETs — game over!',
      type: 'info',
      flashIndices: { ids: removedCardIds, type: 'valid' }
    });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => {
      setNotification(null);
      setScreen('results');
    }, flashMs);
  } else {
    // Host ended early or not enough players — navigate immediately
    setNotification(null);
    setScreen('results');
  }
});
```

- [ ] **Step 4: Verify manually**

Play a game to completion (use browser console to manipulate the deck if needed — or just test with the host "End game now" option which should still navigate immediately). Confirm:
- Mid-game SETs flash green for the configured duration then swap board
- A natural game end flashes the last 3 cards green, shows the toast, then navigates to results

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: use flashDuration setting for set_valid and game_over flash"
```

---

## Task 5 — Game.jsx: FLIP slide animation + CSS wiggle for new cards

**Files:**
- Modify: `client/src/pages/Game.jsx`
- Modify: `client/src/index.css`

**How FLIP works here:**
- `cardRefs` — a ref holding `{ [cardId]: DOMElement }` for every rendered `.card-cell`
- `prevPositionsRef` — a ref holding `{ [cardId]: DOMRect }` captured after the previous board render
- `useLayoutEffect([board])` — runs synchronously after the DOM settles on each board change:
  - If `prevPositionsRef[card.id]` exists → card was on the previous board → calculate positional delta → apply inverse `translate` instantly → force reflow → animate to zero with `transition`
  - If not → new card → add `.card-new` class, remove after 600 ms for the wiggle
  - After processing all cards, update `prevPositionsRef` with fresh rects

- [ ] **Step 1: Add CSS keyframes and `.card-new` rule to `index.css`**

Append to `client/src/index.css`:

```css
/* ─── Card slide & wiggle animation ─────────────────────────────────────────── */
@keyframes card-wiggle {
  0%   { transform: rotate(0deg); }
  20%  { transform: rotate(-4deg); }
  40%  { transform: rotate(4deg); }
  60%  { transform: rotate(-2deg); }
  80%  { transform: rotate(2deg); }
  100% { transform: rotate(0deg); }
}

.card-new {
  animation: card-wiggle 0.5s ease-in-out;
}
```

- [ ] **Step 2: Add refs and `useLayoutEffect` to `Game.jsx`**

At the top of the `Game` component function (after the existing `useRef` declarations), add:

```js
const cardRefs        = useRef({});   // cardId → .card-cell DOM element
const prevPositionsRef = useRef({});  // cardId → DOMRect from previous board render
const isMountedRef    = useRef(false); // skip animation on first mount
```

Then add this `useLayoutEffect` after the existing effects:

```js
useLayoutEffect(() => {
  if (!isMountedRef.current) {
    // First mount — snapshot positions only, no animation
    isMountedRef.current = true;
    board.forEach(card => {
      const el = cardRefs.current[card.id];
      if (el) prevPositionsRef.current[card.id] = el.getBoundingClientRect();
    });
    return;
  }

  const slideDurationS = settings.slideDuration ?? 1;

  board.forEach(card => {
    const el = cardRefs.current[card.id];
    if (!el) return;

    const newRect  = el.getBoundingClientRect();
    const prevRect = prevPositionsRef.current[card.id];

    if (prevRect) {
      // Existing card — FLIP if it moved
      const dx = prevRect.left - newRect.left;
      const dy = prevRect.top  - newRect.top;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transition = 'none';
        el.style.transform  = `translate(${dx}px, ${dy}px)`;
        // Force reflow so the browser registers the starting position
        void el.getBoundingClientRect();
        el.style.transition = `transform ${slideDurationS}s ease-in-out`;
        el.style.transform  = '';
        // Clean up inline styles once the transition finishes
        el.addEventListener('transitionend', () => {
          el.style.transition = '';
          el.style.transform  = '';
        }, { once: true });
      }
    } else {
      // New card — wiggle
      el.classList.add('card-new');
      setTimeout(() => el.classList.remove('card-new'), 600);
    }
  });

  // Snapshot current positions for the next board change
  prevPositionsRef.current = {};
  board.forEach(card => {
    const el = cardRefs.current[card.id];
    if (el) prevPositionsRef.current[card.id] = el.getBoundingClientRect();
  });
}, [board]); // eslint-disable-line react-hooks/exhaustive-deps
// settings.slideDuration intentionally omitted — stale value on change is acceptable
// and including it would trigger spurious FLIP runs
```

- [ ] **Step 3: Attach callback refs to each `.card-cell` div**

In the `board.map(...)` JSX (around line 146), change:

```jsx
<div key={card.id} className={`card-cell ${isHint ? 'card-hint' : ''}`}>
```

to:

```jsx
<div
  key={card.id}
  className={`card-cell ${isHint ? 'card-hint' : ''}`}
  ref={el => {
    if (el) cardRefs.current[card.id] = el;
    else    delete cardRefs.current[card.id];
  }}
>
```

- [ ] **Step 4: Verify manually**

Play a game, find a SET, and submit it. Observe:
- The 3 SET cards flash green for `flashDuration` seconds
- After the flash, the remaining cards slide smoothly to their new grid positions
- The 3 replacement cards appear at their grid positions and wiggle

Also drag the "Card slide" slider in the lobby and confirm the animation speed changes accordingly.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Game.jsx client/src/index.css
git commit -m "feat: FLIP slide animation and wiggle for new cards after SET"
```

---

## Completion Checklist

- [ ] `flashDuration` and `slideDuration` appear in `room.settings` for all clients
- [ ] Both settings update live when host moves the sliders
- [ ] Non-host sees correct read-only values
- [ ] Mid-game SET: 3 cards flash green for `flashDuration` seconds, then board swaps with slide + wiggle
- [ ] Natural game end: last 3 SET cards flash green, toast "No more SETs — game over!" shown, results screen appears after `flashDuration`
- [ ] Host-ended game / not-enough-players: navigates to results immediately (no flash)
- [ ] Card slide duration respects `slideDuration` setting
- [ ] Initial card deal (game start) has no spurious slide animation
