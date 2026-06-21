import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GameInfo from '../components/GameInfo';

const API = '';

const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const v of VALUES) d.push({ suit: s, value: v });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/* ─── Full 9/6 Jacks or Better hand evaluator ─── */
function evaluateHand(hand) {
  const valIdx = hand.map((c) => VALUES.indexOf(c.value)); // 0=2 .. 12=A
  const suits = hand.map((c) => c.suit);
  const sorted = [...valIdx].sort((a, b) => a - b);

  const isFlush = suits.every((s) => s === suits[0]);

  // Straight check
  let isStraight = false;
  if (new Set(sorted).size === 5) {
    if (sorted[4] - sorted[0] === 4) isStraight = true;
    // Ace-low (A 2 3 4 5)
    if (sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2 && sorted[3] === 3 && sorted[4] === 12) isStraight = true;
  }

  const counts = {};
  valIdx.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const groups = Object.values(counts).sort((a, b) => b - a);

  if (isFlush && isStraight && sorted[0] === 8) return { name: 'Royal Flush', mult: 250 };
  if (isFlush && isStraight) return { name: 'Straight Flush', mult: 50 };
  // 8/5 paytable (realistic casino setting, ~2.7% house edge)
  if (groups[0] === 4) return { name: 'Four of a Kind', mult: 25 };
  if (groups[0] === 3 && groups[1] === 2) return { name: 'Full House', mult: 8 };
  if (isFlush) return { name: 'Flush', mult: 5 };
  if (isStraight) return { name: 'Straight', mult: 4 };
  if (groups[0] === 3) return { name: 'Three of a Kind', mult: 3 };
  if (groups[0] === 2 && groups[1] === 2) return { name: 'Two Pair', mult: 2 };
  if (groups[0] === 2) {
    const pairVal = parseInt(Object.entries(counts).find(([, v]) => v === 2)[0]);
    if (pairVal >= 9) return { name: 'Jacks or Better', mult: 1 }; // J=9, Q=10, K=11, A=12
  }
  return { name: 'No Win', mult: 0 };
}

const PAYTABLE = [
  { name: 'Royal Flush', mult: 250 },
  { name: 'Straight Flush', mult: 50 },
  { name: 'Four of a Kind', mult: 25 },
  { name: 'Full House', mult: 8 },
  { name: 'Flush', mult: 5 },
  { name: 'Straight', mult: 4 },
  { name: 'Three of a Kind', mult: 3 },
  { name: 'Two Pair', mult: 2 },
  { name: 'Jacks or Better', mult: 1 },
];

function PokerCard({ card, isHeld, onClick, clickable }) {
  const isRed = card && (card.suit === '♥' || card.suit === '♦');
  return (
    <div className="card-slot">
      <span className="held-label">{isHeld ? 'HELD' : '\u00A0'}</span>
      <div
        className={`playing-card ${isRed ? 'red' : 'black'} ${isHeld ? 'held' : ''} ${clickable ? 'clickable' : ''}`}
        onClick={clickable ? onClick : undefined}
        style={{ width: 80, height: 110 }}
      >
        <span className="card-value">{card.value}</span>
        <span className="card-suit">{card.suit}</span>
      </div>
    </div>
  );
}

export default function VideoPokerGame({ user, setUser }) {
  const navigate = useNavigate();
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [betAmount, setBetAmount] = useState(10);
  const [phase, setPhase] = useState('betting'); // betting | holding | finished
  const [result, setResult] = useState(null);

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

  const deal = async () => {
    if (betAmount <= 0 || betAmount > user.balance) return;
    await updateBalance(-Number(betAmount));

    const d = newDeck();
    setHand([d.pop(), d.pop(), d.pop(), d.pop(), d.pop()]);
    setDeck(d);
    setHeld([false, false, false, false, false]);
    setPhase('holding');
    setResult(null);
  };

  const draw = async () => {
    const d = [...deck];
    const newHand = hand.map((c, i) => (held[i] ? c : d.pop()));
    setHand(newHand);
    setDeck(d);

    const ev = evaluateHand(newHand);
    setResult(ev);
    if (ev.mult > 0) {
      await updateBalance(Number(betAmount) * ev.mult);
    }
    setPhase('finished');
  };

  const toggleHold = (i) => {
    if (phase !== 'holding') return;
    setHeld((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  return (
    <div className="animate-slideUp">
      <span className="back-link" onClick={() => navigate('/')}>← Back to Lobby</span>
      <div className="game-layout">
        <div>
          <div className="game-canvas-container" style={{ flexDirection: 'column', padding: '2rem', background: 'linear-gradient(180deg, #1a0a30 0%, #08080f 100%)' }}>
            {phase === 'betting' ? (
              <div className="text-center">
                <h2 style={{ opacity: 0.15, fontSize: '4rem', marginBottom: '1rem' }}>🎰</h2>
                <p className="text-muted">Deal to begin</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                <div className="hand-row">
                  {hand.map((c, i) => (
                    <PokerCard
                      key={i}
                      card={c}
                      isHeld={held[i]}
                      onClick={() => toggleHold(i)}
                      clickable={phase === 'holding'}
                    />
                  ))}
                </div>

                {phase === 'holding' && (
                  <p className="text-sm text-muted">Click cards to HOLD, then press Draw</p>
                )}

                {phase === 'finished' && result && (
                  <div className="text-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <h2 className={result.mult > 0 ? 'text-green' : 'text-accent'}>{result.name}</h2>
                    {result.mult > 0 && (
                      <p className="text-gold mt-1" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        Won ${(Number(betAmount) * result.mult).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="game-sidebar">
          <div className="card">
            <h3 className="mb-2">Video Poker</h3>
            <GameInfo
              title="How to Play Video Poker"
              description="A single-player card game based on 5-card draw poker. You're dealt 5 cards and choose which to keep (Hold). The rest are replaced — your final hand determines the payout."
              rules={[
                'Place your bet and click Deal to receive 5 cards.',
                'Click any cards you want to keep — they will be marked HELD.',
                'Click Draw — un-held cards are replaced with new ones.',
                'Your final 5-card hand is evaluated against the paytable.',
                'Jacks or Better (a pair of J, Q, K, or A) is the minimum winning hand.',
                'Higher poker hands like Flush, Full House, or Royal Flush pay more.',
              ]}
              edge="~2.7% (8/5 paytable)"
            />
            <p className="text-xs text-muted mb-2">8/5 Jacks or Better</p>

            {/* Paytable */}
            <div className="paytable mb-4">
              {PAYTABLE.map((row) => (
                <React.Fragment key={row.name}>
                  <span className={`hand-name ${result && result.name === row.name ? 'active' : ''}`}>{row.name}</span>
                  <span className={`hand-mult ${result && result.name === row.name ? 'active' : ''}`}>{row.mult}×</span>
                </React.Fragment>
              ))}
            </div>

            {phase === 'betting' ? (
              <div className="bet-panel">
                <div>
                  <label className="bet-label">Bet Amount ($)</label>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="1" />
                </div>
                <div className="bet-presets">
                  {[1, 5, 10, 25].map((v) => (
                    <button key={v} onClick={() => setBetAmount(v)}>${v}</button>
                  ))}
                </div>
                <button className="btn-lg w-full" onClick={deal} disabled={betAmount <= 0 || betAmount > user.balance}>
                  Deal
                </button>
              </div>
            ) : phase === 'holding' ? (
              <div className="bet-panel">
                <p className="text-sm text-muted">Bet: <strong className="text-gold">${Number(betAmount).toFixed(2)}</strong></p>
                <button className="btn-lg w-full btn-green" onClick={draw}>Draw</button>
              </div>
            ) : (
              <div className="bet-panel">
                <button className="btn-lg w-full" onClick={() => setPhase('betting')}>New Hand</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
