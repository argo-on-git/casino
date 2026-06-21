import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GameInfo from '../components/GameInfo';

const API = '';

export default function CrashGame({ user, setUser, socket }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const dataPoints = useRef([]);

  const [gameState, setGameState] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [myBet, setMyBet] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    if (!socket) return;

    socket.on('crash_state', (state) => {
      setGameState(state);
      if (state.bets[user.id]) {
        setMyBet(state.bets[user.id]);
      } else {
        setMyBet(null);
      }

      if (state.status === 'running') {
        dataPoints.current.push(state.multiplier);
      }
      if (state.status === 'waiting') {
        dataPoints.current = [];
        // Start a local countdown
        let t = 5;
        setCountdown(t);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          t -= 1;
          if (t <= 0) {
            clearInterval(countdownRef.current);
            setCountdown(null);
          } else {
            setCountdown(t);
          }
        }, 1000);
      }
    });

    socket.on(`balance_update_${user.id}`, (newBalance) => {
      setUser((prev) => prev ? { ...prev, balance: newBalance } : prev);
    });

    return () => {
      socket.off('crash_state');
      socket.off(`balance_update_${user.id}`);
      clearInterval(countdownRef.current);
    };
  }, [socket, user, navigate, setUser]);

  // Canvas rendering
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Background
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const y = H - (i / 10) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = 1; i < 10; i++) {
      const x = (i / 10) * W;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    const isRunning = gameState?.status === 'running';
    const isCrashed = gameState?.status === 'crashed';
    const isWaiting = gameState?.status === 'waiting';

    if (isWaiting) {
      // Countdown
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.font = `bold ${Math.min(W, H) * 0.35}px Outfit`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countdown !== null ? countdown : '...', W / 2, H / 2);

      ctx.fillStyle = '#7a7a9a';
      ctx.font = `500 ${Math.min(W, H) * 0.06}px Inter`;
      ctx.fillText('Next round starting...', W / 2, H / 2 + Math.min(W, H) * 0.22);
    }

    if ((isRunning || isCrashed) && dataPoints.current.length > 1) {
      const points = dataPoints.current;
      const maxMult = Math.max(2, gameState.multiplier * 1.15);
      const padX = 40;
      const padY = 30;

      // Y-axis labels
      ctx.fillStyle = '#4a4a6a';
      ctx.font = '500 11px Inter';
      ctx.textAlign = 'right';
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const val = 1 + ((maxMult - 1) * i) / steps;
        const y = H - padY - ((val - 1) / (maxMult - 1)) * (H - padY * 2);
        ctx.fillText(`${val.toFixed(1)}x`, padX - 8, y + 4);
      }

      // Curve
      ctx.beginPath();
      const gradient = ctx.createLinearGradient(0, H, 0, 0);
      if (isCrashed) {
        gradient.addColorStop(0, '#dc2626');
        gradient.addColorStop(1, '#f87171');
      } else {
        gradient.addColorStop(0, '#059669');
        gradient.addColorStop(1, '#34d399');
      }
      ctx.strokeStyle = isCrashed ? '#ef4444' : '#34d399';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';

      for (let i = 0; i < points.length; i++) {
        const x = padX + (i / (points.length - 1)) * (W - padX * 2);
        const y = H - padY - ((points[i] - 1) / (maxMult - 1)) * (H - padY * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill area under curve
      const lastX = padX + ((points.length - 1) / (points.length - 1)) * (W - padX * 2);
      const lastY = H - padY - ((points[points.length - 1] - 1) / (maxMult - 1)) * (H - padY * 2);
      ctx.lineTo(lastX, H - padY);
      ctx.lineTo(padX, H - padY);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, lastY, 0, H - padY);
      if (isCrashed) {
        fillGrad.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
        fillGrad.addColorStop(1, 'rgba(239, 68, 68, 0.01)');
      } else {
        fillGrad.addColorStop(0, 'rgba(52, 211, 153, 0.15)');
        fillGrad.addColorStop(1, 'rgba(52, 211, 153, 0.01)');
      }
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Multiplier text
      ctx.fillStyle = isCrashed ? '#ef4444' : '#fff';
      ctx.font = `800 ${Math.min(W, H) * 0.15}px Outfit`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${gameState.multiplier.toFixed(2)}x`, W / 2, H / 2);

      if (isCrashed) {
        ctx.fillStyle = '#f87171';
        ctx.font = `600 ${Math.min(W, H) * 0.05}px Inter`;
        ctx.fillText('CRASHED', W / 2, H / 2 + Math.min(W, H) * 0.12);
      }
    }

    animRef.current = requestAnimationFrame(drawCanvas);
  }, [gameState, countdown]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawCanvas);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawCanvas]);

  const placeBet = () => {
    if (socket && betAmount > 0 && betAmount <= user.balance) {
      socket.emit('crash_bet', { userId: user.id, betAmount: Number(betAmount) });
    }
  };

  const cashOut = () => {
    if (socket) {
      socket.emit('crash_cashout', { userId: user.id });
    }
  };

  const isRunning = gameState?.status === 'running';
  const isWaiting = gameState?.status === 'waiting';

  return (
    <div className="animate-slideUp">
      <span className="back-link" onClick={() => navigate('/')}>← Back to Lobby</span>
      <div className="game-layout">
        <div>
          <div className="game-canvas-container">
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          </div>
          {gameState?.history?.length > 0 && (
            <div className="history-row">
              {gameState.history.map((h, i) => (
                <span key={i} className={`history-pill ${h >= 2 ? 'win' : 'lose'}`}>
                  {h.toFixed(2)}x
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="game-sidebar">
          <div className="card">
            <h3 className="mb-2">Crash</h3>
            <GameInfo
              title="How to Play Crash"
              description="A real-time multiplayer game. A multiplier starts at 1.00× and climbs higher and higher — but it can crash at any moment. The longer you wait, the bigger your potential win, but if you don't cash out before the crash, you lose everything."
              rules={[
                'Place your bet during the waiting phase (5-second countdown).',
                'Once the round starts, the multiplier climbs from 1.00×.',
                'You can only cash out once the multiplier reaches 1.50× or higher.',
                'If the graph crashes before you cash out, you lose your entire bet.',
                'All players see the same game — it crashes at the same point for everyone.',
              ]}
              edge="15%"
            />
            <div className="bet-panel">
              <div>
                <label className="bet-label">Bet Amount ($)</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={!isWaiting || myBet}
                  min="1"
                />
              </div>
              <div className="bet-presets">
                {[5, 10, 50, 100].map((v) => (
                  <button key={v} onClick={() => setBetAmount(v)} disabled={!isWaiting || myBet}>${v}</button>
                ))}
              </div>

              {myBet ? (
                <button
                  className={`btn-lg w-full ${myBet.cashedOut ? 'btn-green' : 'btn-accent'}`}
                  onClick={cashOut}
                  disabled={!isRunning || myBet.cashedOut || (gameState?.multiplier || 1) < 1.5}
                >
                  {myBet.cashedOut
                    ? `Won $${(myBet.betAmount * myBet.cashoutMultiplier).toFixed(2)}`
                    : (gameState?.multiplier || 1) < 1.5
                      ? `Min cashout 1.50×`
                      : `Cash Out $${(myBet.betAmount * (gameState?.multiplier || 1)).toFixed(2)}`}
                </button>
              ) : (
                <button
                  className="btn-lg w-full"
                  onClick={placeBet}
                  disabled={!isWaiting || betAmount <= 0 || betAmount > user?.balance}
                >
                  {isWaiting ? 'Place Bet' : 'Wait for next round...'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
