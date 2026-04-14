# Solo Mode Design

**Date:** 2026-04-14

## Summary

Allow a single player to start and play a game alone, primarily for practice. No new game mode, screen, or mechanics — just lift the 2-player minimum.

## Changes

### Server (`server/server.js`)

Remove the guard that blocks `start_game` when fewer than 2 players are connected:

```js
// Before
if (room.players.filter(p => p.connected).length < 2)
  return ack?.({ ok: false, error: 'Need at least 2 players.' });

// After
if (room.players.filter(p => p.connected).length < 1)
  return ack?.({ ok: false, error: 'Need at least 1 player.' });
```

The `game_over` trigger for `players.length < 2` on disconnect (`server.js` line 314) is left unchanged — if a second player joins mid-game and then disconnects, the game ends, which is correct.

### Client (`client/src/pages/Lobby.jsx`)

- Change `canStart` threshold from `>= 2` to `>= 1`
- Hide the "Waiting for at least one more player…" message when the player is alone (it's only useful when a second player is expected)
- Button label stays "Start Game" when solo (no change needed — `canStart` will be true)

## Out of scope

- No solo-specific scoring, timer, or UI changes
- No changes to settings defaults for solo play
- No distinction between solo and multiplayer in the results screen
