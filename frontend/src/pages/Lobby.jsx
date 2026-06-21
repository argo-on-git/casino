import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '';

const GAMES = [
  {
    id: 'crash',
    path: '/crash',
    icon: '📈',
    name: 'Crash',
    desc: 'Watch the multiplier climb — cash out before it crashes. A shared real-time game for all players.',
    tag: 'LIVE',
    tagClass: 'tag-live',
  },
  {
    id: 'plinko',
    path: '/plinko',
    icon: '🔮',
    name: 'Plinko',
    desc: 'Drop a ball through 8 rows of pegs and watch it bounce into a multiplier slot.',
    tag: 'SOLO',
    tagClass: 'tag-solo',
  },
  {
    id: 'mines',
    path: '/mines',
    icon: '💎',
    name: 'Mines',
    desc: 'Reveal gems on a 5×5 grid while avoiding hidden mines. More risk, more reward.',
    tag: 'SOLO',
    tagClass: 'tag-solo',
  },
  {
    id: 'blackjack',
    path: '/blackjack',
    icon: '🃏',
    name: 'Blackjack',
    desc: 'Classic 21. Hit or Stand against the dealer — standard casino rules.',
    tag: 'SOLO',
    tagClass: 'tag-solo',
  },
  {
    id: 'poker',
    path: '/poker',
    icon: '🎰',
    name: 'Video Poker',
    desc: 'Jacks or Better. Draw 5 cards, hold the best, and redraw for a winning hand.',
    tag: 'SOLO',
    tagClass: 'tag-solo',
  },
];

export default function Lobby({ user, onLogin }) {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: accessCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch {
      setError('Cannot reach server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="login-wrapper">
        <div className="card login-card animate-slideUp">
          <h2>Welcome</h2>
          <p className="subtitle">Enter the access code you were given to start playing.</p>
          <form onSubmit={handleLogin}>
            <input
              id="access-code-input"
              type="text"
              placeholder="ACCESS CODE"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              autoFocus
              autoComplete="off"
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-lg w-full" disabled={loading || !accessCode.trim()}>
              {loading ? 'Connecting...' : 'Enter Casino'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <h2 className="mb-4" style={{ marginTop: '1rem' }}>Select a Game</h2>
      <div className="game-grid">
        {GAMES.map((game) => (
          <div
            key={game.id}
            id={`game-card-${game.id}`}
            className="card card-interactive game-card"
            onClick={() => navigate(game.path)}
          >
            <span className="game-card-icon">{game.icon}</span>
            <h3>{game.name}</h3>
            <p>{game.desc}</p>
            <span className={`tag ${game.tagClass}`}>{game.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
