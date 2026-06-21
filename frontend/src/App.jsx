import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Lobby from './pages/Lobby';
import Admin from './pages/Admin';
import CrashGame from './pages/CrashGame';
import PlinkoGame from './pages/PlinkoGame';
import BlackjackGame from './pages/BlackjackGame';
import VideoPokerGame from './pages/VideoPokerGame';
import MinesGame from './pages/MinesGame';

const API = '';

function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [balanceFlash, setBalanceFlash] = useState('');
  const prevBalance = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const s = io(API);
    setSocket(s);
    return () => s.close();
  }, []);

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (newBalance) => {
      setUser(prev => {
        if (prev) {
          if (prevBalance.current !== null) {
            setBalanceFlash(newBalance > prevBalance.current ? 'flash-green' : 'flash-red');
            setTimeout(() => setBalanceFlash(''), 600);
          }
          prevBalance.current = newBalance;
          return { ...prev, balance: newBalance };
        }
        return prev;
      });
    };
    socket.on(`balance_update_${user.id}`, handler);
    return () => socket.off(`balance_update_${user.id}`, handler);
  }, [socket, user?.id]);

  const handleLogin = (userData) => {
    prevBalance.current = userData.balance;
    setUser(userData);
    navigate('/');
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/');
  };

  return (
    <>
      <header className="app-header">
        <div className="app-logo" onClick={() => navigate('/')}>
          0 EDGE<span>CASINO</span>
        </div>
        {user && (
          <div className="header-right">
            <div className="balance-display">
              <span className="balance-icon">💰</span>
              <span className={`balance-amount ${balanceFlash}`}>
                ${user.balance.toFixed(2)}
              </span>
            </div>
            <button className="btn-outline" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </header>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Lobby user={user} onLogin={handleLogin} />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/crash" element={<CrashGame user={user} setUser={setUser} socket={socket} />} />
          <Route path="/plinko" element={<PlinkoGame user={user} setUser={setUser} />} />
          <Route path="/blackjack" element={<BlackjackGame user={user} setUser={setUser} />} />
          <Route path="/poker" element={<VideoPokerGame user={user} setUser={setUser} />} />
          <Route path="/mines" element={<MinesGame user={user} setUser={setUser} />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
