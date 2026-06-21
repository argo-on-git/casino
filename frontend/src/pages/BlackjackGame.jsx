import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GameInfo from '../components/GameInfo';

const API = '';

const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const v of VALUES) {
    d.push({ suit: s, value: v, weight: parseInt(v) || (v === 'A' ? 11 : 10) });
  }
  // Fisher-Yates shuffle
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function score(hand) {
  let s = 0, aces = 0;
  for (const c of hand) {
    s += c.weight;
    if (c.value === 'A') aces++;
  }
  while (s > 21 && aces > 0) { s -= 10; aces--; }
  return s;
}

function Card({ card, hidden, animDelay = 0 }) {
  const isRed = card && (card.suit === '♥' || card.suit === '♦');
  if (hidden) {
    return (
      <div className="playing-card face-down" style={{ animationDelay: `${animDelay}ms` }} />
    );
  }
  return (
    <div className={`playing-card ${isRed ? 'red' : 'black'}`} style={{ animation: `fadeIn 0.3s ease-out ${animDelay}ms both` }}>
      <span className="card-value">{card.value}</span>
      <span className="card-suit">{card.suit}</span>
    </div>
  );
}

export default function BlackjackGame({ user, setUser }) {
  const navigate = useNavigate();
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [betAmount, setBetAmount] = useState(10);
  const [phase, setPhase] = useState('betting'); // betting | playing | dealerTurn | finished
  const [resultMsg, setResultMsg] = useState('');
  const [resultClass, setResultClass] = useState('');

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
    const ph = [d.pop(), d.pop()];
    const dh = [d.pop(), d.pop()];
    setPlayerHand(ph);
    setDealerHand(dh);
    setDeck(d);
    setResultMsg('');
    setResultClass('');

    if (score(ph) === 21) {
      // Natural blackjack
      setPhase('finished');
      if (score(dh) === 21) {
        setResultMsg('Both Blackjack — Push');
        setResultClass('text-gold');
        await updateBalance(Number(betAmount));
      } else {
        setResultMsg('Blackjack! 🎉');
        setResultClass('text-green');
        await updateBalance(Number(betAmount) * 2.5);
      }
    } else {
      setPhase('playing');
    }
  };

  const hit = () => {
    const d = [...deck];
    const ph = [...playerHand, d.pop()];
    setPlayerHand(ph);
    setDeck(d);
    if (score(ph) > 21) {
      setPhase('finished');
      setResultMsg('Bust!');
      setResultClass('text-accent');
    }
  };

  const stand = () => setPhase('dealerTurn');

  const doubleDown = async () => {
    if (betAmount > user.balance) return;
    await updateBalance(-Number(betAmount));
    const d = [...deck];
    const ph = [...playerHand, d.pop()];
    setPlayerHand(ph);
    setDeck(d);
    setBetAmount((prev) => Number(prev) * 2);
    if (score(ph) > 21) {
      setPhase('finished');
      setResultMsg('Bust!');
      setResultClass('text-accent');
    } else {
      setPhase('dealerTurn');
    }
  };

  useEffect(() => {
    if (phase !== 'dealerTurn') return;
    const play = async () => {
      let dh = [...dealerHand];
      let d = [...deck];
      while (score(dh) < 17) {
        dh = [...dh, d.pop()];
      }
      setDealerHand(dh);
      setDeck(d);

      const ps = score(playerHand);
      const ds = score(dh);

      // Use the possibly-doubled bet for payout
      const currentBet = Number(betAmount);

      if (ds > 21 || ps > ds) {
        setResultMsg(`You Win! +$${currentBet.toFixed(2)}`);
        setResultClass('text-green');
        await updateBalance(currentBet * 2);
      } else if (ds > ps) {
        setResultMsg('Dealer Wins');
        setResultClass('text-accent');
      } else {
        setResultMsg('Push — Tie');
        setResultClass('text-gold');
        await updateBalance(currentBet);
      }
      setPhase('finished');
    };
    // Small delay for visual effect
    setTimeout(play, 500);
  }, [phase]);

  const newGame = () => {
    setPhase('betting');
    setPlayerHand([]);
    setDealerHand([]);
    setResultMsg('');
    setBetAmount(10);
  };

  const showDealer = phase === 'finished' || phase === 'dealerTurn';

  return (
    <div className="animate-slideUp">
      <span className="back-link" onClick={() => navigate('/')}>← Back to Lobby</span>
      <div className="game-layout">
        <div>
          <div className="game-canvas-container" style={{ flexDirection: 'column', padding: '2rem', background: 'linear-gradient(180deg, #0a2e1a 0%, #08080f 100%)' }}>
            {phase === 'betting' ? (
              <div className="text-center">
                <h2 style={{ opacity: 0.2, fontSize: '4rem', marginBottom: '1rem' }}>🃏</h2>
                <p className="text-muted">Place your bet to start</p>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center' }}>
                {/* Dealer */}
                <div className="text-center">
                  <p className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Dealer {showDealer ? `— ${score(dealerHand)}` : ''}
                  </p>
                  <div className="hand-row">
                    {dealerHand.map((c, i) => (
                      <Card key={i} card={c} hidden={i === 1 && !showDealer} animDelay={i * 120} />
                    ))}
                  </div>
                </div>

                {/* Result */}
                {phase === 'finished' && resultMsg && (
                  <h2 className={resultClass} style={{ animation: 'fadeIn 0.3s ease-out' }}>{resultMsg}</h2>
                )}

                {/* Player */}
                <div className="text-center">
                  <p className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Your Hand — {score(playerHand)}
                  </p>
                  <div className="hand-row">
                    {playerHand.map((c, i) => (
                      <Card key={i} card={c} animDelay={i * 120 + 200} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="game-sidebar">
          <div className="card">
            <h3 className="mb-2">Blackjack</h3>
            <GameInfo
              title="How to Play Blackjack"
              description="Try to get a hand value as close to 21 as possible without going over. You play against the dealer — beat their hand to win."
              rules={[
                'Place a bet and two cards are dealt to you and the dealer.',
                'Number cards = face value, Face cards = 10, Aces = 1 or 11.',
                'Hit to draw another card, Stand to keep your hand.',
                'Double Down doubles your bet and gives you exactly one more card.',
                'Go over 21 and you Bust — instant loss regardless of the dealer.',
                'Dealer must hit on 16 and stand on 17.',
                'Blackjack (21 on first 2 cards) pays 3:2.',
              ]}
              edge="~2% (varies by strategy)"
            />
            {phase === 'betting' ? (
              <div className="bet-panel">
                <div>
                  <label className="bet-label">Bet Amount ($)</label>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="1" />
                </div>
                <div className="bet-presets">
                  {[5, 10, 25, 50].map((v) => (
                    <button key={v} onClick={() => setBetAmount(v)}>${v}</button>
                  ))}
                </div>
                <button className="btn-lg w-full" onClick={deal} disabled={betAmount <= 0 || betAmount > user.balance}>
                  Deal
                </button>
              </div>
            ) : phase === 'playing' ? (
              <div className="bet-panel">
                <p className="text-sm text-muted mb-2">Bet: <strong className="text-gold">${Number(betAmount).toFixed(2)}</strong></p>
                <button className="btn-lg w-full btn-green" onClick={hit}>Hit</button>
                <button className="btn-lg w-full btn-accent" onClick={stand}>Stand</button>
                {playerHand.length === 2 && Number(betAmount) <= user.balance && (
                  <button className="btn-lg w-full btn-gold" onClick={doubleDown}>Double Down</button>
                )}
              </div>
            ) : (
              <div className="bet-panel">
                <button className="btn-lg w-full" onClick={newGame}>New Hand</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
