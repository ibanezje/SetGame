const express = require('express');
const http    = require('http');
const cors    = require('cors');
const { Server } = require('socket.io');
const { createDeck, isValidSet, findAllSets, dealCards, refillAfterSet } = require('./gameLogic');

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true }));

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const rooms = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms[code]);
  return code;
}

function makeRoom(hostId, hostName) {
  return {
    code: null,
    players: [{ id: hostId, name: hostName, score: 0, isHost: true, connected: true }],
    settings: {
      thinkingTime: 10,
      penaltyEnabled: true,
      hintDelay: 20,      // seconds before a hint card is revealed (0 = disabled)
      flashDuration: 3,   // seconds — green flash after a valid SET
      slideDuration: 1    // seconds — card slide animation after board swap
    },
    state: 'lobby',
    deck: [],
    board: [],
    claimingPlayerId: null,
    claimTimer: null,
    hintTimer: null
  };
}

function roomPublic(room) {
  return {
    code: room.code,
    players: room.players,
    settings: room.settings,
    state: room.state,
    board: room.board,
    deckSize: room.deck.length,
    claimingPlayerId: room.claimingPlayerId
  };
}

function findRoomBySocket(socketId) {
  return Object.values(rooms).find(r => r.players.some(p => p.id === socketId));
}

function clearClaim(room) {
  if (room.claimTimer) { clearTimeout(room.claimTimer); room.claimTimer = null; }
  room.claimingPlayerId = null;
}

/** Start (or restart) the hint timer for a room */
function startHintTimer(room) {
  if (room.hintTimer) { clearTimeout(room.hintTimer); room.hintTimer = null; }
  const delay = room.settings.hintDelay;
  if (!delay || delay <= 0) return;

  room.hintTimer = setTimeout(() => {
    room.hintTimer = null;
    if (room.state !== 'playing' || room.claimingPlayerId) return;
    const sets = findAllSets(room.board);
    if (sets.length === 0) return;
    // Reveal the first card of the first valid SET
    io.to(room.code).emit('hint_card', { cardId: room.board[sets[0][0]].id });
  }, delay * 1000);
}

function clearHintTimer(room) {
  if (room.hintTimer) { clearTimeout(room.hintTimer); room.hintTimer = null; }
}

// ─── Socket events ────────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log('connect', socket.id);

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ playerName }, ack) => {
    const name = (playerName || 'Player').trim().slice(0, 20);
    const code = generateCode();
    const room = makeRoom(socket.id, name);
    room.code = code;
    rooms[code] = room;
    socket.join(code);
    ack({ ok: true, room: roomPublic(room) });
  });

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, playerName }, ack) => {
    const room = rooms[(code || '').toUpperCase()];
    if (!room)                return ack({ ok: false, error: 'Room not found.' });
    if (room.state !== 'lobby') return ack({ ok: false, error: 'Game already in progress.' });
    if (room.players.length >= 4) return ack({ ok: false, error: 'Room is full (max 4 players).' });

    const name = (playerName || 'Player').trim().slice(0, 20);
    room.players.push({ id: socket.id, name, score: 0, isHost: false, connected: true });
    socket.join(room.code);
    ack({ ok: true, room: roomPublic(room) });
    io.to(room.code).emit('room_updated', roomPublic(room));
  });

  // ── Update settings (host only) ───────────────────────────────────────────
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

  // ── Start game (host only) ────────────────────────────────────────────────
  socket.on('start_game', (_, ack) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return ack?.({ ok: false, error: 'Not host.' });
    if (room.players.filter(p => p.connected).length < 2)
      return ack?.({ ok: false, error: 'Need at least 2 players.' });

    room.players.forEach(p => { p.score = 0; });
    room.deck  = createDeck();
    room.board = [];
    clearClaim(room);
    clearHintTimer(room);

    const extra = dealCards(room.deck, room.board);
    room.state  = 'playing';

    io.to(room.code).emit('game_started', { ...roomPublic(room), boardExpanded: extra > 0 ? extra : 0 });
    startHintTimer(room);
    ack?.({ ok: true });
  });

  // ── Claim SET ─────────────────────────────────────────────────────────────
  socket.on('claim_set', () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;
    if (room.claimingPlayerId) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    clearHintTimer(room); // pause hint while someone is thinking
    room.claimingPlayerId = socket.id;

    io.to(room.code).emit('set_claimed', {
      claimingPlayerId: socket.id,
      claimingPlayerName: player.name,
      thinkingTime: room.settings.thinkingTime
    });

    room.claimTimer = setTimeout(() => {
      if (room.claimingPlayerId !== socket.id) return;
      clearClaim(room);
      if (room.settings.penaltyEnabled) player.score -= 5;
      io.to(room.code).emit('claim_timeout', {
        playerId: socket.id,
        players: room.players,
        penaltyApplied: room.settings.penaltyEnabled
      });
      startHintTimer(room); // restart hint after timeout
    }, room.settings.thinkingTime * 1000);
  });

  // ── Cancel claim ──────────────────────────────────────────────────────────
  socket.on('cancel_claim', () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.claimingPlayerId !== socket.id) return;
    clearClaim(room);
    io.to(room.code).emit('claim_cancelled', { playerId: socket.id });
    startHintTimer(room);
  });

  // ── Submit SET ────────────────────────────────────────────────────────────
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
        io.to(room.code).emit('game_over', { players: room.players, removedCardIds: cardIds });
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

  // ── Reset game (host → back to lobby) ─────────────────────────────────────
  socket.on('reset_game', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;

    clearClaim(room);
    clearHintTimer(room);
    room.state = 'lobby';
    room.deck  = [];
    room.board = [];
    room.players.forEach(p => { p.score = 0; });
    io.to(room.code).emit('room_updated', roomPublic(room));
  });

  // ── End game early (host → results with current scores) ───────────────────
  socket.on('end_game', () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;

    clearClaim(room);
    clearHintTimer(room);
    room.state = 'finished';
    io.to(room.code).emit('game_over', { players: room.players, reason: 'host_ended' });
  });

  // ── Play again (host → lobby, preserve players) ───────────────────────────
  socket.on('play_again', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;

    clearClaim(room);
    clearHintTimer(room);
    room.state = 'lobby';
    room.deck  = [];
    room.board = [];
    room.players.forEach(p => { p.score = 0; });
    io.to(room.code).emit('room_updated', roomPublic(room));
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnecting', () => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.claimingPlayerId === socket.id) clearClaim(room);
    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      clearHintTimer(room);
      delete rooms[room.code];
      return;
    }

    if (!room.players.find(p => p.isHost)) room.players[0].isHost = true;

    if (room.state === 'playing' && room.players.length < 2) {
      clearHintTimer(room);
      room.state = 'finished';
      io.to(room.code).emit('game_over', { players: room.players, reason: 'not_enough_players' });
    } else {
      io.to(room.code).emit('room_updated', roomPublic(room));
    }
  });

  socket.on('disconnect', () => console.log('disconnect', socket.id));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SET server listening on :${PORT}`));
