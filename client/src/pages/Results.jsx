export default function Results({ players, myId, isHost, onPlayAgain, onLeave, reason }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="results-screen">
      <div className="results-content">
        <h1 className="results-title">Game Over!</h1>

        {reason === 'not_enough_players' && (
          <p className="results-note">A player disconnected — game ended early.</p>
        )}

        <div className="podium">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`podium-row ${p.id === myId ? 'podium-me' : ''} ${i === 0 ? 'podium-first' : ''}`}
            >
              <span className="podium-rank">{medals[i] || `${i + 1}.`}</span>
              <span className="podium-name">
                {p.name}
                {p.id === myId && <span className="you-tag"> (you)</span>}
              </span>
              <span className="podium-score">{p.score} pts</span>
            </div>
          ))}
        </div>

        {winner?.id === myId && (
          <p className="winner-msg">You won! 🎉</p>
        )}
      </div>

      <div className="results-actions">
        {isHost ? (
          <button className="btn btn-primary btn-full btn-large" onClick={onPlayAgain}>
            Play Again
          </button>
        ) : (
          <p className="waiting-msg center">Waiting for the host to restart…</p>
        )}
        <button className="btn btn-ghost btn-full" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </div>
  );
}
