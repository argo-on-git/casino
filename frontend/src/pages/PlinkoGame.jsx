import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GameInfo from '../components/GameInfo';

const API = '';

/* ─── Plinko Payouts with ~9% house edge ───
   8 rows → 9 slots. Binomial probabilities: C(8,k)/256
   RTP ≈ 0.91 (~9% house edge)
*/
const PAYOUTS = [23, 4.5, 1.1, 0.35, 0.2, 0.35, 1.1, 4.5, 23];
const ROWS = 8;
const PEG_RADIUS = 5;
const BALL_RADIUS = 7;

function getColor(mult) {
  if (mult >= 25) return '#f43f5e';
  if (mult >= 5) return '#f59e0b';
  if (mult >= 1.2) return '#22d3ee';
  return '#4a4a6a';
}

export default function PlinkoGame({ user, setUser }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const ballsRef = useRef([]);   // active balls being animated
  const trailsRef = useRef([]);  // fading trail dots
  const landedRef = useRef([]);  // recent landing flash animations

  const [betAmount, setBetAmount] = useState(10);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

  // Persist layout dimensions
  const layoutRef = useRef(null);

  const getLayout = useCallback((W, H) => {
    const padTop = 40;
    const padBottom = 50;
    const padX = 30;
    const spacingY = (H - padTop - padBottom) / ROWS;
    const spacingX = (W - padX * 2) / (ROWS + 2);

    const pegs = [];
    for (let row = 0; row < ROWS; row++) {
      const numPegs = row + 3;
      for (let col = 0; col < numPegs; col++) {
        const x = W / 2 + (col - (numPegs - 1) / 2) * spacingX;
        const y = padTop + row * spacingY;
        pegs.push({ x, y, row, col });
      }
    }

    const slots = [];
    const numSlots = 9;
    const slotWidth = spacingX;
    for (let i = 0; i < numSlots; i++) {
      const x = W / 2 + (i - (numSlots - 1) / 2) * slotWidth;
      const y = padTop + ROWS * spacingY;
      slots.push({ x, y, width: slotWidth, payout: PAYOUTS[i] });
    }

    return { pegs, slots, spacingX, spacingY, padTop, padBottom };
  }, []);

  const updateBalance = async (amount) => {
    try {
      const res = await fetch(`${API}/api/user/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount }),
      });
      const data = await res.json();
      setUser((prev) => (prev ? { ...prev, balance: data.balance } : prev));
    } catch (e) {
      console.error(e);
    }
  };

  const dropBall = async () => {
    if (!user || betAmount <= 0 || betAmount > user.balance) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const layout = getLayout(W, H);

    // Deduct bet
    await updateBalance(-Number(betAmount));

    // Predetermine path
    const decisions = [];
    let col = 0;
    for (let i = 0; i < ROWS; i++) {
      const goRight = Math.random() > 0.5;
      decisions.push(goRight);
      if (goRight) col++;
    }

    // Build waypoints
    const waypoints = [{ x: W / 2, y: 10 }]; // start above
    let currentCol = 0;
    for (let row = 0; row < ROWS; row++) {
      // Position on the peg at this row
      const numPegs = row + 3;
      const pegX = W / 2 + (currentCol - (row) / 2) * layout.spacingX;
      const pegY = layout.padTop + row * layout.spacingY;
      waypoints.push({ x: pegX, y: pegY - BALL_RADIUS - PEG_RADIUS - 2 });

      // After bouncing
      if (decisions[row]) currentCol++;
      const nextX = W / 2 + (currentCol - (row + 1) / 2) * layout.spacingX;
      const betweenY = pegY + layout.spacingY * 0.5;
      waypoints.push({ x: nextX, y: betweenY });
    }

    // Final landing
    const slot = layout.slots[col];
    waypoints.push({ x: slot.x, y: slot.y + 5 });

    const ball = {
      waypoints,
      currentWP: 0,
      x: waypoints[0].x,
      y: waypoints[0].y,
      progress: 0,
      speed: 0.045,
      slotIndex: col,
      bet: Number(betAmount),
    };

    ballsRef.current.push(ball);
  };

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const W = rect.width;
      const H = rect.height;
      const layout = getLayout(W, H);

      // Background
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, W, H);

      // Pegs
      for (const peg of layout.pegs) {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a4a';
        ctx.fill();
        // Subtle glow
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG_RADIUS + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
        ctx.fill();
      }

      // Slots
      const slotH = 32;
      for (let i = 0; i < layout.slots.length; i++) {
        const s = layout.slots[i];
        const col = getColor(s.payout);
        const sw = s.width * 0.85;

        // Check if any landed animation is active for this slot
        const landed = landedRef.current.find((l) => l.index === i && l.alpha > 0);
        const glow = landed ? landed.alpha : 0;

        ctx.fillStyle = col + (glow > 0.3 ? '33' : '18');
        ctx.beginPath();
        ctx.roundRect(s.x - sw / 2, s.y, sw, slotH, 6);
        ctx.fill();

        if (glow > 0) {
          ctx.shadowColor = col;
          ctx.shadowBlur = 20 * glow;
          ctx.fillStyle = col + '55';
          ctx.beginPath();
          ctx.roundRect(s.x - sw / 2, s.y, sw, slotH, 6);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = col;
        ctx.font = '700 13px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${s.payout}×`, s.x, s.y + slotH / 2);
      }

      // Trail dots
      trailsRef.current = trailsRef.current.filter((t) => t.alpha > 0.01);
      for (const t of trailsRef.current) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL_RADIUS * 0.5 * t.alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${t.alpha * 0.5})`;
        ctx.fill();
        t.alpha -= 0.03;
      }

      // Landed flash animations
      landedRef.current = landedRef.current.filter((l) => l.alpha > 0.01);
      for (const l of landedRef.current) {
        l.alpha -= 0.015;
      }

      // Balls
      const toRemove = [];
      for (let bi = 0; bi < ballsRef.current.length; bi++) {
        const ball = ballsRef.current[bi];

        if (ball.currentWP < ball.waypoints.length - 1) {
          const from = ball.waypoints[ball.currentWP];
          const to = ball.waypoints[ball.currentWP + 1];

          // Ease in-out
          const t = ball.progress;
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

          ball.x = from.x + (to.x - from.x) * ease;
          ball.y = from.y + (to.y - from.y) * ease;

          ball.progress += ball.speed;

          // Trail
          if (ball.currentWP > 0) {
            trailsRef.current.push({ x: ball.x, y: ball.y, alpha: 0.8 });
          }

          if (ball.progress >= 1) {
            ball.progress = 0;
            ball.currentWP++;
            ball.speed = Math.min(0.12, ball.speed + 0.004); // accelerate
          }
        } else {
          // Ball landed!
          toRemove.push(bi);
          const mult = PAYOUTS[ball.slotIndex];
          const win = ball.bet * mult;
          landedRef.current.push({ index: ball.slotIndex, alpha: 1.0 });

          if (win > 0) {
            updateBalance(win);
          }
          setLastResult({ mult, win });
          setHistory((prev) => [mult, ...prev].slice(0, 15));
        }
      }
      // Remove landed balls (iterate backwards)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        ballsRef.current.splice(toRemove[i], 1);
      }

      // Draw active balls
      for (const ball of ballsRef.current) {
        // Glow
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
        ctx.fill();
        // Ball
        const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, BALL_RADIUS);
        grad.addColorStop(0, '#fde68a');
        grad.addColorStop(1, '#f59e0b');
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [getLayout]);

  if (!user) { navigate('/'); return null; }

  return (
    <div className="animate-slideUp">
      <span className="back-link" onClick={() => navigate('/')}>← Back to Lobby</span>
      <div className="game-layout">
        <div>
          <div className="game-canvas-container" style={{ aspectRatio: '4 / 3' }}>
            <canvas ref={canvasRef} />
          </div>
          {history.length > 0 && (
            <div className="history-row">
              {history.map((h, i) => (
                <span key={i} className={`history-pill ${h >= 1 ? 'win' : 'lose'}`}>
                  {h}×
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="game-sidebar">
          <div className="card">
            <h3 className="mb-2">Plinko</h3>
            <GameInfo
              title="How to Play Plinko"
              description="Drop a ball from the top of the board. It bounces through 8 rows of pegs, going randomly left or right at each row. Where it lands determines your payout multiplier."
              rules={[
                'Set your bet amount and click Drop Ball.',
                'The ball bounces through 8 rows of pegs randomly.',
                'It lands in one of 9 slots at the bottom, each with a multiplier.',
                'Edge slots (24×) are rare but pay big. Center slots are common but pay little.',
                'You can drop multiple balls in quick succession.',
              ]}
              edge="~9%"
            />
            <div className="bet-panel">
              <div>
                <label className="bet-label">Bet Amount ($)</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  min="1"
                />
              </div>
              <div className="bet-presets">
                {[1, 5, 10, 50].map((v) => (
                  <button key={v} onClick={() => setBetAmount(v)}>${v}</button>
                ))}
              </div>
              <button className="btn-lg w-full btn-gold" onClick={dropBall} disabled={betAmount <= 0 || betAmount > user.balance}>
                Drop Ball
              </button>

              {lastResult && (
                <div className="text-center mt-2" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span className="text-xs text-muted">Last: </span>
                  <span style={{ color: getColor(lastResult.mult), fontWeight: 700, fontSize: '1.1rem' }}>
                    {lastResult.mult}× — ${lastResult.win.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
