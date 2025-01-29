// src/server.js
require('dotenv').config(); // Must be first line
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('./models/User');

// Debug environment variables
console.log('GitHub Client ID:', process.env.GITHUB_CLIENT_ID);
console.log('Environment:', process.env.NODE_ENV);

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL_PROD
    : process.env.FRONTEND_URL_DEV,
  credentials: true
}));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport configuration
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.NODE_ENV === 'production'
      ? 'https://lebaincode-backend.onrender.com'
      : 'http://localhost:5000'}/api/auth/github/callback`
  },
  async function(accessToken, refreshToken, profile, done) {
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

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', require('./routes/auth'));

const authMiddleware = require('./middleware/auth');

// User profile route
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      progress: user.progress
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});