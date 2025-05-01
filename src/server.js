// src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
const http = require('http');
const WebSocket = require('ws');
const passport = require('passport');
const { configureGitHubStrategy } = require('./config/passport');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware for logging requests
app.use((req, res, next) => {
  console.log('\n=== Incoming Request ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  next();
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'https://lebaincodefront.vercel.app', 'https://frontend-swart-tau-76.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Set-Cookie']
}));

app.use(passport.initialize());
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));


app.use(passport.session());

// Configure GitHub strategy
configureGitHubStrategy();

// Routes 
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/email'));
app.use('/api/admin/analytics', require('./routes/analytics'));


// Development-only routes
if (process.env.NODE_ENV === 'development') {
  app.post('/api/auth/test-user', async (req, res) => {
    try {
      const User = require('./models/User');
      console.log('Creating test user...');
      
      const latestUser = await User.findOne({ role: 'user' })
        .sort({ username: -1 });
      
      const newUserNumber = latestUser 
        ? String(Number(latestUser.username) + 1).padStart(3, '0')
        : '001';

      const testUser = await User.create({
        username: newUserNumber,
        role: 'user',
        progress: {
          cModule: { completed: 0, total: 10 },
          examModule: { completed: 0, total: 4, isUnlocked: false }
        }
      });
      
      console.log('Test user created:', {
        id: testUser._id,
        username: testUser.username
      });
      
      res.json(testUser);
    } catch (err) {
      console.error('Test user creation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/debug/session', (req, res) => {
    console.log('\n=== Debug Session Info ===');
    console.log('Session:', req.session);
    res.json({ session: req.session });
  });
}

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/auth/verify-session', (req, res) => {
  console.log('Token from cookies:', req.cookies.token); 
  res.send('Check the console for the token');
});

// WebSocket setup with logging
wss.on('connection', (ws) => {
  console.log('\n=== New WebSocket Connection ===');
  
  ws.on('message', (message) => {
    try {
      const { type, data } = JSON.parse(message.toString());
      console.log('WebSocket message received:', { type, data });
      
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, data }));
        }
      });
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('\n=== Error Handler ===');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n=== Server Started ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log('BACKEND_URL:', process.env.BACKEND_URL);
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  console.log('GitHub callback URL:', `${process.env.BACKEND_URL}/api/auth/github/callback`);
});