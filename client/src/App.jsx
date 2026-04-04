import { useState, useEffect, useRef } from 'react';
import { socket, emitWithAck } from './socket';
import Home    from './pages/Home';
import Lobby   from './pages/Lobby';
import Game    from './pages/Game';
import Results from './pages/Results';

export default function App() {
  const [screen,        setScreen]        = useState('home');
  const [room,          setRoom]          = useState(null);
  const [myId,          setMyId]          = useState(null);
  const [hintCardIndex, setHintCardIndex] = useState(null);
  const [notification,  setNotification]  = useState(null); // { message, type, flashIndices? }
  const [connError,     setConnError]     = useState('');

  const notifTimer  = useRef(null);
  const flashTimer  = useRef(null);

  function showNotification(message, type = 'info', flashIndices = null, duration = 2500) {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification({ message, type, flashIndices });
    notifTimer.current = setTimeout(() => setNotification(null), duration);
  }

  function triggerFlash(indices, type) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setNotification(prev => ({ ...prev, flashIndices: { indices, type } }));
    flashTimer.current = setTimeout(() => setNotification(prev => prev ? { ...prev, flashIndices: null } : null), 800);
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
    });
    socket.on('connect_error', () => setConnError('Connection lost. Retrying…'));
    socket.on('disconnect',    () => setConnError('Disconnected. Reconnecting…'));
    socket.on('reconnect',     () => setConnError(''));

    socket.on('room_updated', (updatedRoom) => {
      setRoom(updatedRoom);
      setHintCardIndex(null);
      if (updatedRoom.state === 'lobby')    setScreen('lobby');
      if (updatedRoom.state === 'finished') setScreen('results');
    });

    socket.on('game_started', (data) => {
      setRoom(data);
      setHintCardIndex(null);
      setNotification(null);
      setScreen('game');
      if (data.boardExpanded > 0) {
        showNotification(`No SET at 12 cards — ${data.boardExpanded} more dealt!`, 'warning');
      }
    });

    socket.on('set_claimed', ({ claimingPlayerId }) => {
      setHintCardIndex(null); // hide hint while someone is thinking
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

    socket.on('set_valid', ({ indices, players, board, deckSize, boardExpanded }) => {
      setRoom(prev => prev ? { ...prev, players, board, deckSize, claimingPlayerId: null } : prev);
      setHintCardIndex(null);
      triggerFlash(indices, 'valid');
      if (boardExpanded > 0) {
        setTimeout(() => showNotification(`No SET at 12 — ${boardExpanded} more cards dealt!`, 'warning'), 900);
      }
    });

    socket.on('set_invalid', ({ indices, players, penaltyApplied }) => {
      setRoom(prev => prev ? { ...prev, players, claimingPlayerId: null } : prev);
      triggerFlash(indices, 'invalid');
      if (penaltyApplied) {
        showNotification('✗ Not a SET  (−5 pts)', 'error');
      } else {
        showNotification('✗ Not a SET', 'error');
      }
    });

    socket.on('hint_card', ({ cardIndex }) => {
      setHintCardIndex(cardIndex);
    });

    socket.on('game_over', ({ players, reason }) => {
      setRoom(prev => prev ? { ...prev, players, state: 'finished', claimingPlayerId: null } : prev);
      setHintCardIndex(null);
      setNotification(null);
      setScreen('results');
    });

    return () => { socket.disconnect(); socket.removeAllListeners(); };
  }, []);

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

  function handleSubmitSet(indices) {
    socket.emit('submit_set', { indices });
  }

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
    setHintCardIndex(null);
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
          hintCardIndex={hintCardIndex}
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
