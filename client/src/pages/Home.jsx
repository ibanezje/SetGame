import { useState } from 'react';

export default function Home({ onCreateRoom, onJoinRoom, initialCode }) {
  const [name,    setName]    = useState('');
  const [code,    setCode]    = useState(initialCode || '');
  const [tab,     setTab]     = useState(initialCode ? 'join' : 'create'); // 'create' | 'join'
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();

  async function handleCreate(e) {
    e.preventDefault();
    if (!trimmedName) return setError('Enter your name first.');
    setError(''); setLoading(true);
    try { await onCreateRoom(trimmedName); }
    catch (err) { setError(err.message || 'Could not create room.'); }
    finally { setLoading(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!trimmedName) return setError('Enter your name first.');
    if (!trimmedCode) return setError('Enter the room code.');
    setError(''); setLoading(true);
    try { await onJoinRoom(trimmedName, trimmedCode); }
    catch (err) { setError(err.message || 'Could not join room.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="home-screen">
      <div className="home-logo">
        <div className="logo-cards">
          <span className="logo-card red" />
          <span className="logo-card green" />
          <span className="logo-card purple" />
        </div>
        <h1>SET</h1>
        <p className="home-subtitle">Multiplayer Card Game</p>
      </div>

      <div className="home-card">
        <div className="tab-bar">
          <button
            className={`tab-btn ${tab === 'create' ? 'active' : ''}`}
            onClick={() => { setTab('create'); setError(''); }}
          >Create Room</button>
          <button
            className={`tab-btn ${tab === 'join' ? 'active' : ''}`}
            onClick={() => { setTab('join'); setError(''); }}
          >Join Room</button>
        </div>

        <form onSubmit={tab === 'create' ? handleCreate : handleJoin}>
          <div className="field">
            <label htmlFor="player-name">Your Name</label>
            <input
              id="player-name"
              type="text"
              placeholder="e.g. Alex"
              maxLength={20}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {tab === 'join' && (
            <div className="field">
              <label htmlFor="room-code">Room Code</label>
              <input
                id="room-code"
                type="text"
                placeholder="e.g. K9PZ"
                maxLength={4}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="code-input"
              />
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading
              ? 'Connecting…'
              : tab === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </form>
      </div>

      <p className="home-rules-hint">2–4 players · Find SETs before your opponents!</p>
      <p className="home-version">v{__APP_VERSION__}</p>
    </div>
  );
}
