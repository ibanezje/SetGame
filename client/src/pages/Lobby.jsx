import { useState } from 'react';

export default function Lobby({ room, myId, onStartGame, onUpdateSettings, onLeave }) {
  const me     = room.players.find(p => p.id === myId);
  const isHost = me?.isHost;
  const [copied, setCopied] = useState(false);

  const shareLink = `${window.location.origin}?code=${room.code}`;

  function copyCode() {
    navigator.clipboard.writeText(shareLink).catch(() => navigator.clipboard.writeText(room.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const connectedCount = room.players.length;
  const canStart       = isHost && connectedCount >= 2;

  const hintLabel = room.settings.hintDelay === 0
    ? 'Off'
    : `${room.settings.hintDelay}s`;

  return (
    <div className="lobby-screen">
      <div className="lobby-header">
        <button className="btn-ghost btn-small" onClick={onLeave}>← Leave</button>
        <h2>Lobby</h2>
        <div />
      </div>

      {/* Room code */}
      <div className="room-code-block">
        <p className="room-code-label">Room Code</p>
        <div className="room-code-display">{room.code}</div>
        <button className="btn btn-secondary" onClick={copyCode}>
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
        <p className="room-code-hint">Share this code so friends can join</p>
      </div>

      {/* Player list */}
      <div className="section">
        <h3>Players ({connectedCount}/4)</h3>
        <ul className="player-list">
          {room.players.map(p => (
            <li key={p.id} className="player-item">
              <span className="player-avatar">{p.name.charAt(0).toUpperCase()}</span>
              <span className="player-name">{p.name}{p.id === myId ? ' (you)' : ''}</span>
              {p.isHost && <span className="badge host-badge">Host</span>}
            </li>
          ))}
        </ul>
        {connectedCount < 2 && (
          <p className="waiting-msg">Waiting for at least one more player…</p>
        )}
      </div>

      {/* Settings */}
      {isHost ? (
        <div className="section settings-panel">
          <h3>Settings</h3>

          <div className="setting-row">
            <label>Thinking time</label>
            <div className="setting-control">
              <input
                type="range" min={3} max={30} step={1}
                value={room.settings.thinkingTime}
                onChange={e => onUpdateSettings({ thinkingTime: Number(e.target.value) })}
              />
              <span className="setting-value">{room.settings.thinkingTime}s</span>
            </div>
          </div>

          <div className="setting-row">
            <label>Penalty for wrong SET</label>
            <div className="setting-control">
              <button
                className={`toggle-btn ${room.settings.penaltyEnabled ? 'on' : 'off'}`}
                onClick={() => onUpdateSettings({ penaltyEnabled: !room.settings.penaltyEnabled })}
              >
                {room.settings.penaltyEnabled ? '−5 pts ON' : '−5 pts OFF'}
              </button>
            </div>
          </div>

          <div className="setting-row">
            <label>
              Hint card after…
              <span className="setting-hint-note"> (highlights 1 card from a SET)</span>
            </label>
            <div className="setting-control">
              <input
                type="range" min={0} max={60} step={5}
                value={room.settings.hintDelay}
                onChange={e => onUpdateSettings({ hintDelay: Number(e.target.value) })}
              />
              <span className="setting-value">{hintLabel}</span>
            </div>
          </div>

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
        </div>
      ) : (
        <div className="section settings-panel read-only">
          <h3>Settings</h3>
          <p>Thinking time: <strong>{room.settings.thinkingTime}s</strong></p>
          <p>Penalty: <strong>{room.settings.penaltyEnabled ? '−5 pts enabled' : 'disabled'}</strong></p>
          <p>Hint card: <strong>{hintLabel}</strong></p>
          <p>Card flash: <strong>{room.settings.flashDuration}s</strong></p>
          <p>Card slide: <strong>{room.settings.slideDuration}s</strong></p>
        </div>
      )}

      <div className="lobby-footer">
        {isHost ? (
          <button
            className="btn btn-primary btn-full btn-large"
            onClick={onStartGame}
            disabled={!canStart}
          >
            {canStart ? 'Start Game' : 'Waiting for players…'}
          </button>
        ) : (
          <p className="waiting-msg center">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}
