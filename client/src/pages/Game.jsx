import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import Card from '../components/Card';

export default function Game({
  board,
  deckSize,
  players,
  myId,
  claimingPlayerId,
  settings,
  hintCardId,         // card ID to subtly highlight, or null
  notification,       // { message, type } | null  – toast from parent
  onClaimSet,
  onSubmitSet,
  onCancelClaim,
  onResetGame,
  onEndGame,
  isHost,
}) {
  const [selected,     setSelected]     = useState([]);
  const [timeLeft,     setTimeLeft]     = useState(null);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'reset' | 'end' | null
  const timerRef = useRef(null);

  const cardRefs        = useRef({});    // cardId → .card-cell DOM element
  const prevPositionsRef = useRef({});   // cardId → DOMRect from previous board render
  const isMountedRef    = useRef(false); // skip animation on first mount

  const isClaiming = claimingPlayerId === myId;

  // ── Reset selection when claim ends ──────────────────────────────────────
  useEffect(() => {
    if (!claimingPlayerId) {
      setSelected([]);
      setTimeLeft(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }, [claimingPlayerId]);

  // ── Countdown when WE are claiming ───────────────────────────────────────
  useEffect(() => {
    if (isClaiming) {
      setTimeLeft(settings.thinkingTime);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); timerRef.current = null; return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeLeft(null);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isClaiming, settings.thinkingTime]);

  // ── Auto-submit when 3 cards selected ───────────────────────────────────
  useEffect(() => {
    if (isClaiming && selected.length === 3) {
      onSubmitSet(selected);
    }
  }, [selected, isClaiming, onSubmitSet]);

  // ── FLIP slide animation + wiggle for new cards ──────────────────────────
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

  function toggleCard(cardId) {
    if (!isClaiming) return;
    setSelected(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : prev.length < 3 ? [...prev, cardId] : prev
    );
  }

  function handleConfirm(action) {
    setConfirmAction(null);
    setMenuOpen(false);
    if (action === 'reset') onResetGame();
    if (action === 'end')   onEndGame();
  }

  const claimingPlayer = players.find(p => p.id === claimingPlayerId);
  const sortedPlayers  = [...players].sort((a, b) => b.score - a.score);
  const timerPercent   = timeLeft !== null ? (timeLeft / settings.thinkingTime) * 100 : 100;
  const timerColor     = timerPercent > 50 ? '#22aa22' : timerPercent > 25 ? '#f5c518' : '#cc2222';

  return (
    <div className="game-screen" onClick={() => { if (menuOpen) setMenuOpen(false); }}>

      {/* ── Top bar ── */}
      <div className="game-topbar">
        <div className="deck-counter">
          <span className="deck-icon">🃏</span>
          <span>{deckSize} left</span>
        </div>
        <div className="scoreboard-inline">
          {sortedPlayers.map(p => (
            <div key={p.id} className={`score-chip ${p.id === myId ? 'mine' : ''}`}>
              <span className="score-name">{p.name.split(' ')[0]}</span>
              <span className="score-pts">{p.score}</span>
            </div>
          ))}
        </div>
        {isHost && (
          <div className="host-menu-wrap" onClick={e => e.stopPropagation()}>
            <button
              className="host-menu-btn"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Game menu"
            >⋮</button>
            {menuOpen && (
              <div className="host-menu-dropdown">
                <button onClick={() => { setMenuOpen(false); setConfirmAction('reset'); }}>
                  🔄 Reset to lobby
                </button>
                <button onClick={() => { setMenuOpen(false); setConfirmAction('end'); }}>
                  🏁 End game now
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status banner ── */}
      {claimingPlayerId && (
        <div className={`status-banner ${isClaiming ? 'claiming-me' : 'claiming-other'}`}>
          {isClaiming ? (
            <div className="banner-inner">
              <span>Pick 3 cards!</span>
              <div className="timer-bar-wrap">
                <div className="timer-bar" style={{ width: `${timerPercent}%`, background: timerColor }} />
              </div>
              <span className="timer-num">{timeLeft}s</span>
            </div>
          ) : (
            <span>⚡ {claimingPlayer?.name} is choosing…</span>
          )}
        </div>
      )}

      {/* ── Toast notification ── */}
      {notification && (
        <div className={`game-toast toast-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* ── Card grid ── */}
      <div className="card-grid" style={{ '--cols': board.length > 12 ? 4 : 3 }}>
        {board.map((card) => {
          const isSelected    = selected.includes(card.id);
          const isHighlighted = notification?.flashIndices?.type === 'valid'   && notification?.flashIndices?.ids?.includes(card.id);
          const isInvalid     = notification?.flashIndices?.type === 'invalid' && notification?.flashIndices?.ids?.includes(card.id);
          const isHint        = hintCardId === card.id && !isSelected && !claimingPlayerId;
          const isDisabled    = !isClaiming;

          return (
            <div
              key={card.id}
              className={`card-cell ${isHint ? 'card-hint' : ''}`}
              ref={el => {
                if (el) cardRefs.current[card.id] = el;
                else    delete cardRefs.current[card.id];
              }}
            >
              <Card
                card={card}
                selected={isSelected}
                highlighted={isHighlighted}
                invalid={isInvalid}
                onClick={() => toggleCard(card.id)}
                disabled={isDisabled}
              />
            </div>
          );
        })}
      </div>

      {/* ── Bottom action area ── */}
      <div className="game-footer">
        {!claimingPlayerId && (
          <button className="btn btn-set btn-full btn-large" onClick={onClaimSet}>
            I found a SET!
          </button>
        )}
        {isClaiming && (
          <button className="btn btn-ghost btn-full" onClick={() => { onCancelClaim(); setSelected([]); }}>
            Cancel
          </button>
        )}
      </div>

      {/* ── Confirm dialog ── */}
      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{confirmAction === 'reset' ? 'Reset to lobby?' : 'End game now?'}</h3>
            <p>
              {confirmAction === 'reset'
                ? 'All scores will be cleared and everyone returns to the lobby.'
                : 'The game will end with current scores.'}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className={`btn ${confirmAction === 'reset' ? 'btn-secondary' : 'btn-danger'}`}
                onClick={() => handleConfirm(confirmAction)}
              >
                {confirmAction === 'reset' ? 'Reset' : 'End Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
