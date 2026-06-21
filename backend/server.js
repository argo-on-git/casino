const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// -- API Routes --

// Admin: Create new user access code
app.post('/api/admin/users', async (req, res) => {
  const { accessCode, balance, role } = req.body;
  try {
    const user = await prisma.user.create({
      data: { accessCode, balance: Number(balance) || 1000, role: role || 'USER' }
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create user (code might exist)' });
  }
});

// Admin: Get all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { balance: 'desc' } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { accessCode } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { accessCode } });
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid access code' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Balance Update (for simple API-based games)
app.post('/api/user/balance', async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } }
    });
    io.emit(`balance_update_${userId}`, user.balance);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: 'Update failed' });
  }
});

// -- Realtime Game: Crash --

let crashState = {
  status: 'waiting',
  multiplier: 1.0,
  crashPoint: 0,
  history: [],
  bets: {} // { userId: { betAmount, cashedOut, cashoutMultiplier } }
};

function generateCrashPoint() {
  // 15% house edge: fair would be 1/(1-r), we multiply by 0.85
  const r = Math.random();
  const point = 0.85 / (1 - r);
  return Math.max(1.01, point);
}

function startCrashGame() {
  crashState.status = 'waiting';
  crashState.multiplier = 1.0;
  crashState.bets = {};
  io.emit('crash_state', crashState);
  
  setTimeout(() => {
    crashState.status = 'running';
    crashState.crashPoint = generateCrashPoint();
    io.emit('crash_state', crashState);
    
    let lastUpdate = Date.now();
    const interval = setInterval(async () => {
      const now = Date.now();
      const dt = now - lastUpdate;
      lastUpdate = now;
      
      // Multiplier grows exponentially, dt is usually ~50ms
      crashState.multiplier *= Math.pow(1.06, dt / 100);
      
      if (crashState.multiplier >= crashState.crashPoint) {
        crashState.multiplier = crashState.crashPoint;
        crashState.status = 'crashed';
        crashState.history.unshift(crashState.crashPoint);
        if (crashState.history.length > 10) crashState.history.pop();
        
        io.emit('crash_state', crashState);
        clearInterval(interval);
        setTimeout(startCrashGame, 5000); 
      } else {
        io.emit('crash_state', crashState);
      }
    }, 50);
  }, 5000);
}

io.on('connection', (socket) => {
  socket.emit('crash_state', crashState);
  
  socket.on('crash_bet', async ({ userId, betAmount }) => {
    if (crashState.status !== 'waiting') return;
    if (crashState.bets[userId]) return;
    
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: betAmount } }
      });
      crashState.bets[userId] = { betAmount, cashedOut: false };
      io.emit(`balance_update_${userId}`, user.balance);
      io.emit('crash_state', crashState);
    } catch (e) {
      console.error('Bet error', e);
    }
  });

  socket.on('crash_cashout', async ({ userId }) => {
    if (crashState.status !== 'running') return;
    if (crashState.multiplier < 1.5) return; // minimum 1.5x cashout
    const bet = crashState.bets[userId];
    if (!bet || bet.cashedOut) return;

    bet.cashedOut = true;
    bet.cashoutMultiplier = crashState.multiplier;
    const winAmount = bet.betAmount * crashState.multiplier;
    
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: winAmount } }
      });
      io.emit(`balance_update_${userId}`, user.balance);
      io.emit('crash_state', crashState);
    } catch (e) {
      console.error('Cashout error', e);
    }
  });
});

startCrashGame();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
