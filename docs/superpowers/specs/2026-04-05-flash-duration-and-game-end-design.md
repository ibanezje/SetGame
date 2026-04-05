# Flash Duration & Game-End SET Display

**Date:** 2026-04-05

## Summary

Three related changes to how a correct SET is displayed:

1. The green flash duration is configurable (default 3s, was hardcoded 800ms).
2. The final SET of the game now flashes green for the full flash duration before the Results screen appears.
3. A "No more SETs — game over!" toast is shown during that final flash.

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

## What does NOT change

- `set_valid` flow for non-final sets is unchanged except for the timing.
- Results screen content is unchanged.
- Score logic is unchanged.
- All existing `game_over` reasons other than natural end are unaffected.
