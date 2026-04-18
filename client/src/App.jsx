import { useState, useEffect, useRef, useCallback } from 'react';
import { socket, emitWithAck, startKeepAlive, stopKeepAlive } from './socket';
import Home    from './pages/Home';
import Lobby   from './pages/Lobby';
import Game    from './pages/Game';
import Results from './pages/Results';

export default function App() {
  const [screen,        setScreen]        = useState('home');
  const [room,          setRoom]          = useState(null);
  const [myId,          setMyId]          = useState(null);
  const [hintCardId, setHintCardId] = useState(null);
  const [notification,  setNotification]  = useState(null); // { message, type, flashIndices? }
  const [connError,     setConnError]     = useState('');

  const notifTimer  = useRef(null);
  const flashTimer  = useRef(null);
  const pendingBoard = useRef(null);
  const settingsRef  = useRef({ thinkingTime: 10, penaltyEnabled: true, hintDelay: 20, flashDuration: 3, slideDuration: 1 });

  function showNotification(message, type = 'info', flashIndices = null, duration = 2500) {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification({ message, type, flashIndices });
    notifTimer.current = setTimeout(() => setNotification(null), duration);
  }

  // ── Pull room code from URL on load ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    if (code) {
      sessionStorage.setItem('pendingCode', code.toUpperCase());
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // ── Socket connection & events ────────────────────────────────────────────
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setMyId(socket.id);
      setConnError('');
      startKeepAlive();
    });
    socket.on('connect_error', () => setConnError('Connection lost. Retrying…'));
    socket.on('disconnect',    () => { setConnError('Disconnected. Reconnecting…'); stopKeepAlive(); });
    socket.on('reconnect',     () => { setConnError(''); startKeepAlive(); });

    socket.on('room_updated', (updatedRoom) => {
      setRoom(updatedRoom);
      setHintCardId(null);
      if (updatedRoom.state === 'lobby') setScreen('lobby');
      if (updatedRoom.state === 'finished') {
        if (flashTimer.current) { clearTimeout(flashTimer.current); flashTimer.current = null; }
        setNotification(null);
        setScreen('results');
      }
    });

    socket.on('game_started', (data) => {
      setRoom(data);
      setHintCardId(null);
      setNotification(null);
      setScreen('game');
      if (data.boardExpanded > 0) {
        showNotification(`No SET at 12 cards — ${data.boardExpanded} more dealt!`, 'warning');
      }
    });

    socket.on('set_claimed', ({ claimingPlayerId }) => {
      setHintCardId(null); // hide hint while someone is thinking
      setRoom(prev => prev ? { ...prev, claimingPlayerId } : prev);
    });

    socket.on('claim_timeout', ({ playerId, players, penaltyApplied }) => {
      setRoom(prev => prev ? { ...prev, claimingPlayerId: null, players } : prev);
      const name = players.find(p => p.id === playerId)?.name || 'Player';
      showNotification(
        penaltyApplied ? `⏱ ${name} ran out of time (−5 pts)` : `⏱ ${name} ran out of time`,
        'warning'
      );
    });

    socket.on('claim_cancelled', () => {
      setRoom(prev => prev ? { ...prev, claimingPlayerId: null } : prev);
    });

    socket.on('set_valid', ({ removedCardIds, players, board, deckSize, boardExpanded }) => {
      // Update scores and clear claim immediately
      setRoom(prev => prev ? { ...prev, players, deckSize, claimingPlayerId: null } : prev);
      setHintCardId(null);

      // Store the new board for delayed swap
      pendingBoard.current = board;

      // Flash the removed cards green on the current board
      setNotification(prev => ({ ...prev, flashIndices: { ids: removedCardIds, type: 'valid' } }));

      // After flash duration, swap in the new board
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

    socket.on('hint_card', ({ cardId }) => { setHintCardId(cardId); });

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

    return () => { stopKeepAlive(); socket.disconnect(); socket.removeAllListeners(); };
  }, []);

  useEffect(() => {
    if (room?.settings) settingsRef.current = room.settings;
  }, [room?.settings]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleCreateRoom(playerName) {
    const res = await emitWithAck('create_room', { playerName });
    setRoom(res.room);
    setMyId(socket.id);
    setScreen('lobby');
  }

  async function handleJoinRoom(playerName, code) {
    const res = await emitWithAck('join_room', { playerName, code });
    setRoom(res.room);
    setMyId(socket.id);
    setScreen('lobby');
  }

  function handleUpdateSettings(settings) {
    socket.emit('update_settings', settings);
  }

  async function handleStartGame() {
    await emitWithAck('start_game', {});
  }

  function handleClaimSet() {
    socket.emit('claim_set');
  }

  const handleSubmitSet = useCallback((cardIds) => {
    socket.emit('submit_set', { cardIds });
  }, []);

  function handleCancelClaim() {
    socket.emit('cancel_claim');
  }

  function handleResetGame() {
    socket.emit('reset_game');
  }

  function handleEndGame() {
    socket.emit('end_game');
  }

  function handlePlayAgain() {
    socket.emit('play_again');
  }

  function handleLeave() {
    socket.disconnect();
    socket.connect();
    setRoom(null);
    setHintCardId(null);
    setNotification(null);
    setScreen('home');
  }

  const isHost = room?.players.find(p => p.id === myId)?.isHost ?? false;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {connError && <div className="conn-banner">{connError}</div>}

      {screen === 'home' && (
        <Home onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      )}

      {screen === 'lobby' && room && (
        <Lobby
          room={room}
          myId={myId}
          onStartGame={handleStartGame}
          onUpdateSettings={handleUpdateSettings}
          onLeave={handleLeave}
        />
      )}

      {screen === 'game' && room && (
        <Game
          board={room.board}
          deckSize={room.deckSize}
          players={room.players}
          myId={myId}
          claimingPlayerId={room.claimingPlayerId}
          settings={room.settings}
          hintCardId={hintCardId}
          notification={notification}
          isHost={isHost}
          onClaimSet={handleClaimSet}
          onSubmitSet={handleSubmitSet}
          onCancelClaim={handleCancelClaim}
          onResetGame={handleResetGame}
          onEndGame={handleEndGame}
        />
      )}

      {screen === 'results' && room && (
        <Results
          players={room.players}
          myId={myId}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
