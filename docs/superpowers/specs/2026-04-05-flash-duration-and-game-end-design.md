# Flash Duration, Game-End SET Display & Card Slide Animation

**Date:** 2026-04-05

## Summary

Four related changes to how a correct SET is displayed:

1. The green flash duration is configurable (default 3s, was hardcoded 800ms).
2. The final SET of the game now flashes green for the full flash duration before the Results screen appears.
3. A "No more SETs — game over!" toast is shown during that final flash.
4. After the flash, remaining cards slide to their new grid positions (FLIP animation); incoming replacement cards appear instantly with a wiggle. Slide duration is configurable (default 1s).

## New Setting: `flashDuration`

Added to `room.settings` alongside existing settings.

| Field | Type | Default | Range | Step |
|---|---|---|---|---|
| `flashDuration` | number (seconds) | `3` | 1–5 | 0.5 |

### Server changes

- `makeRoom`: add `flashDuration: 3` to `settings`
- `update_settings` handler: accept `flashDuration`, clamp to `[1, 5]`

### Lobby UI changes

- **Host view**: slider 1–5, step 0.5, label `"Card flash: Xs"`
- **Read-only view**: plain text `"Card flash: Xs"`

## Mid-game flash (`set_valid`)

Replace hardcoded `800` ms delay in `App.jsx`'s `set_valid` handler with `room.settings.flashDuration * 1000`. No other changes to this flow.

## Game-ending SET flash (`game_over`)

### Server

Pass `removedCardIds: cardIds` in the `game_over` emit when the game ends due to a valid set with no remaining sets and empty deck. Existing `game_over` emits for other reasons (host ended, not enough players) do not include `removedCardIds`.

### Client (`App.jsx` — `game_over` handler)

**If `removedCardIds` is present (natural end):**
1. Set `flashIndices: { ids: removedCardIds, type: 'valid' }` on notification state.
2. Show toast: `"No more SETs — game over!"` with duration = `flashDuration * 1000` ms.
3. After `flashDuration * 1000` ms, clear flash and navigate to Results screen.

**If `removedCardIds` is absent (host ended early / not enough players):**
- Navigate to Results immediately, same as current behavior.

## Card Slide & Wiggle Animation

### New setting: `slideDuration`

| Field | Type | Default | Range | Step |
|---|---|---|---|---|
| `slideDuration` | number (seconds) | `1` | 0.2–3 | 0.1 |

- **Server `makeRoom`**: add `slideDuration: 1` to `settings`
- **Server `update_settings`**: accept `slideDuration`, clamp to `[0.2, 3]`
- **Lobby host view**: slider 0.2–3, step 0.1, label `"Card slide: Xs"`
- **Lobby read-only view**: plain text `"Card slide: Xs"`

### FLIP animation (`Game.jsx`)

React keeps existing cards mounted across re-renders because they share the same `key` (card ID). The FLIP technique exploits this:

1. A `cardRefs` map (callback ref on each `.card-cell` div) stores each card's DOM element by ID.
2. A `prevPositionsRef` stores each card's `getBoundingClientRect()` snapshot, updated after every render via `useLayoutEffect`.
3. When the `board` prop changes, `useLayoutEffect` runs after the DOM has settled into its new layout. For each card present in both old and new board:
   - Calculate delta: `dx = prevRect.x - newRect.x`, `dy = prevRect.y - newRect.y`
   - Instantly apply `translate(dx, dy)` (no transition)
   - Force a reflow (`el.getBoundingClientRect()`)
   - Set `transition: transform ${slideDuration}s ease-in-out` and clear the transform — browser animates the slide to the natural position
4. Cards whose ID was absent from `prevPositionsRef` are new. Add CSS class `card-new` and remove it after 600 ms to play a keyframe wiggle (rotate ±3°).

All FLIP logic lives in `Game.jsx`. No changes to `App.jsx`, server, or `Card.jsx`.

### CSS additions

```css
@keyframes card-wiggle {
  0%   { transform: rotate(0deg); }
  25%  { transform: rotate(-3deg); }
  50%  { transform: rotate(3deg); }
  75%  { transform: rotate(-2deg); }
  100% { transform: rotate(0deg); }
}
.card-new {
  animation: card-wiggle 0.5s ease-in-out;
}
```

## What does NOT change

- `set_valid` flow for non-final sets is unchanged except for the timing.
- Results screen content is unchanged.
- Score logic is unchanged.
- All existing `game_over` reasons other than natural end are unaffected.
- `Card.jsx` internals are unchanged.
