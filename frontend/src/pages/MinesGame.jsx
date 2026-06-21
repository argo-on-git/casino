import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GameInfo from '../components/GameInfo';

const API = '';
const GRID_SIZE = 25; // 5x5
const HOUSE_EDGE = 0.92; // 8% house edge
const MIN_MINES = 3;
const MIN_REVEALS = 3; // must reveal 3 tiles before cashout

function getMultiplier(mineCount, revealedCount) {
  if (revealedCount === 0) return 1;
  let prob = 1;
  for (let i = 0; i < revealedCount; i++) {
    prob *= (GRID_SIZE - mineCount - i) / (GRID_SIZE - i);
  }
  return (1 / prob) * HOUSE_EDGE;
}

function placeMines(count) {
  const positions = new Set();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return positions;
}

export default function MinesGame({ user, setUser }) {
  const navigate = useNavigate();
  const [mineCount, setMineCount] = useState(5);
  const [betAmount, setBetAmount] = useState(10);
  const [phase, setPhase] = useState('setup'); // setup | playing | won | lost
  const [mines, setMines] = useState(new Set());
  const [revealed, setRevealed] = useState(new Set());
  const [triggeredTile, setTriggeredTile] = useState(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [resultMsg, setResultMsg] = useState('');

  const updateBalance = useCallback(async (amount) => {
    try {
      const res = await fetch(`${API}/api/user/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount }),
      });
      const data = await res.json();
      setUser((prev) => (prev ? { ...prev, balance: data.balance } : prev));
    } catch (e) { console.error(e); }
  }, [user?.id, setUser]);

  if (!user) { navigate('/'); return null; }

  const startGame = async () => {
    const bet = Number(betAmount);
    if (bet <= 0 || bet > user.balance) return;
    await updateBalance(-bet);
    setMines(placeMines(mineCount));
    setRevealed(new Set());
    setTriggeredTile(null);
    setCurrentMultiplier(1);
    setResultMsg('');
    setPhase('playing');
  };

  const clickTile = (index) => {
    if (phase !== 'playing' || revealed.has(index)) return;

    if (mines.has(index)) {
      setTriggeredTile(index);
      setRevealed(new Set([...revealed, index]));
      setPhase('lost');
      setResultMsg('💥 You hit a mine!');
    } else {
      const newRevealed = new Set([...revealed, index]);
      setRevealed(newRevealed);
      const mult = getMultiplier(mineCount, newRevealed.size);
      setCurrentMultiplier(mult);

      if (newRevealed.size === GRID_SIZE - mineCount) {
        cashOut(mult);
      }
    }
  };

  const cashOut = async (mult) => {
    const m = mult || currentMultiplier;
    const winAmount = Number(betAmount) * m;
    await updateBalance(winAmount);
    setPhase('won');
    setResultMsg(`Cashed out $${winAmount.toFixed(2)}`);
  };

  const nextMultiplier = phase === 'playing' ? getMultiplier(mineCount, revealed.size + 1) : 0;

  const reset = () => {
    setPhase('setup');
    setRevealed(new Set());
    setMines(new Set());
    setTriggeredTile(null);
    setCurrentMultiplier(1);
    setResultMsg('');
  };

  const showMines = phase === 'lost' || phase === 'won';
  const bet = Number(betAmount);

  return (
    <div className="animate-slideUp">
      <span className="back-link" onClick={() => navigate('/')}>← Back to Lobby</span>
      <div className="game-layout">
        <div>
          <div style={{
            background: 'linear-gradient(180deg, #0f0a1e 0%, #08080f 100%)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '1.5rem',
            minHeight: '450px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}>
            {phase === 'setup' ? (
              <div className="text-center">
                <div style={{ fontSize: '4rem', opacity: 0.15 }}>💎</div>
                <p className="text-muted mt-2">Configure your game and press Start</p>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '6px',
                  width: '100%',
                  maxWidth: '360px',
                }}>
                  {Array.from({ length: GRID_SIZE }, (_, i) => {
                    const isRevealed = revealed.has(i);
                    const isMine = mines.has(i);
                    const showAsMine = showMines && isMine;
                    const isTriggered = i === triggeredTile;
                    const canClick = phase === 'playing' && !isRevealed;

                    let bg = 'linear-gradient(135deg, rgba(30, 30, 55, 0.8), rgba(20, 20, 40, 0.9))';
                    let border = '1.5px solid rgba(255,255,255,0.06)';
                    let content = '';
                    let cursor = canClick ? 'pointer' : 'default';
                    let extraStyle = {};

                    if (isRevealed && !isMine) {
                      bg = 'rgba(52, 211, 153, 0.12)';
                      border = '1.5px solid rgba(52, 211, 153, 0.35)';
                      content = '💎';
                    } else if (showAsMine) {
                      bg = isTriggered ? 'rgba(244, 63, 94, 0.3)' : 'rgba(244, 63, 94, 0.15)';
                      border = '1.5px solid rgba(244, 63, 94, 0.4)';
                      content = '💣';
                      if (isTriggered) {
                        extraStyle.boxShadow = '0 0 20px rgba(244, 63, 94, 0.3)';
                      }
                    }

                    return (
                      <div
                        key={i}
                        onClick={() => canClick && clickTile(i)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '10px',
                          background: bg,
                          border: border,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.6rem',
                          cursor: cursor,
                          transition: 'all 0.15s',
                          userSelect: 'none',
                          ...extraStyle,
                        }}
                        onMouseEnter={(e) => {
                          if (canClick) {
                            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                            e.currentTarget.style.transform = 'scale(1.06)';
                            e.currentTarget.style.boxShadow = '0 0 12px rgba(168, 85, 247, 0.35)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (canClick) {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>

                {phase === 'playing' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    maxWidth: '360px',
                    padding: '0.75rem 1rem',
                    background: 'rgba(30, 30, 55, 0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#7a7a9a' }}>Next tile</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>
                      {nextMultiplier.toFixed(2)}×
                    </span>
                  </div>
                )}

                {(phase === 'won' || phase === 'lost') && (
                  <div className="text-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <h3 style={{ color: phase === 'won' ? '#34d399' : '#f43f5e' }}>{resultMsg}</h3>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="game-sidebar">
          <div className="card">
            <h3 className="mb-2">Mines</h3>
            <GameInfo
              title="How to Play Mines"
              description="Choose how many mines to hide in a 5×5 grid, then click tiles to reveal gems. Each safe tile increases your multiplier. Cash out anytime — but hit a mine and you lose your bet!"
              rules={[
                'Select the number of mines (3–24) and place your bet.',
                'Click tiles to reveal them — gems are safe, mines end the game.',
                'Your multiplier increases with each safe tile revealed.',
                'You must reveal at least 3 tiles before you can cash out.',
                'More mines = higher risk but bigger multipliers.',
              ]}
              edge="8%"
            />

            {phase === 'setup' ? (
              <div className="bet-panel">
                <div>
                  <label className="bet-label">Number of Mines</label>
                  <input
                    type="range"
                    min={MIN_MINES}
                    max="24"
                    value={mineCount}
                    onChange={(e) => setMineCount(Number(e.target.value))}
                    style={{ background: 'transparent', padding: 0 }}
                  />
                  <div className="flex justify-between text-xs text-muted" style={{ marginTop: '-0.5rem' }}>
                    <span>{MIN_MINES} (Safe)</span>
                    <strong style={{ fontSize: '1rem', color: '#f43f5e' }}>{mineCount}</strong>
                    <span>24 (Risky)</span>
                  </div>
                </div>
                <div>
                  <label className="bet-label">Bet Amount ($)</label>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="1" />
                </div>
                <div className="bet-presets">
                  {[5, 10, 25, 50].map((v) => (
                    <button key={v} onClick={() => setBetAmount(v)}>${v}</button>
                  ))}
                </div>
                <button className="btn-lg w-full" onClick={startGame} disabled={bet <= 0 || bet > user.balance}>
                  Start Game
                </button>
              </div>
            ) : phase === 'playing' ? (
              <div className="bet-panel">
                <p className="text-sm text-muted">
                  Bet: <strong style={{ color: '#fbbf24' }}>${bet.toFixed(2)}</strong>
                </p>
                <p className="text-sm text-muted">
                  Mines: <strong style={{ color: '#f43f5e' }}>{mineCount}</strong> · Revealed: <strong style={{ color: '#34d399' }}>{revealed.size}</strong>
                </p>
                <div style={{ padding: '1rem', background: 'rgba(30,30,55,0.6)', borderRadius: '8px', textAlign: 'center' }}>
                  <p className="text-xs text-muted">Current Payout</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
                    {revealed.size > 0 ? `$${(bet * currentMultiplier).toFixed(2)}` : '$0.00'}
                  </p>
                  <p className="text-xs text-muted">{currentMultiplier.toFixed(2)}×</p>
                </div>
                <button
                  className="btn-lg w-full btn-green"
                  onClick={() => cashOut()}
                  disabled={revealed.size < MIN_REVEALS}
                >
                  {revealed.size < MIN_REVEALS
                    ? `Reveal ${MIN_REVEALS - revealed.size} more to cash out`
                    : 'Cash Out'}
                </button>
              </div>
            ) : (
              <div className="bet-panel">
                <div style={{ padding: '1rem', background: 'rgba(30,30,55,0.6)', borderRadius: '8px', textAlign: 'center' }}>
                  <p className="text-xs text-muted">Result</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: phase === 'won' ? '#34d399' : '#f43f5e' }}>
                    {phase === 'won' ? `+$${(bet * currentMultiplier).toFixed(2)}` : `-$${bet.toFixed(2)}`}
                  </p>
                </div>
                <button className="btn-lg w-full" onClick={reset}>Play Again</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
