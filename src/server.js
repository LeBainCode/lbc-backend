// src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('./models/User');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const adminRoutes = require('./routes/admin');
const emailRoutes = require('./routes/email');

// Debug environment variables
console.log('GitHub Client ID:', process.env.GITHUB_CLIENT_ID);
console.log('Environment:', process.env.NODE_ENV);

// CORS configuration - Updated to fix the CORS error
app.use(cors({
  origin: ['http://localhost:3000', 'https://lebaincodefront.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Set-Cookie']
}));

// Additional headers for CORS preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Essential middleware
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// GitHub OAuth configuration
const githubConfig = {
  clientID: process.env.NODE_ENV === 'production' 
    ? process.env.GITHUB_CLIENT_ID_PROD 
    : process.env.GITHUB_CLIENT_ID_DEV,
  clientSecret: process.env.NODE_ENV === 'production' 
    ? process.env.GITHUB_CLIENT_SECRET_PROD 
    : process.env.GITHUB_CLIENT_SECRET_DEV,
  callbackURL: process.env.NODE_ENV === 'production'
    ? 'https://lebaincode-backend.onrender.com/api/auth/github/callback'
    : 'http://localhost:5000/api/auth/github/callback'
};

passport.use(new GitHubStrategy(githubConfig, async function(accessToken, refreshToken, profile, done) {
    try {
      let user = await User.findOne({ githubId: profile.id });
      
      if (!user) {
        const latestUser = await User.findOne({ role: 'user' })
          .sort({ username: -1 });
        
        const newUserNumber = latestUser 
          ? String(Number(latestUser.username) + 1).padStart(3, '0')
          : '001';

        user = await User.create({
          username: newUserNumber,
          githubId: profile.id,
          role: 'user',
          progress: {
            cModule: { completed: 0, total: 10 },
            examModule: { completed: 0, total: 4, isUnlocked: false }
          }
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', adminRoutes);
app.use('/api', emailRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`${new Date().toISOString()} - Error:`, err);
  res.status(500).json({ 
    error: 'Server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// WebSocket setup
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const { type, data } = JSON.parse(message.toString());
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

// Server startup
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});