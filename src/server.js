// src/server.js
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

const app = express();

// Debug environment variables
console.log('GitHub Client ID:', process.env.GITHUB_CLIENT_ID);
console.log('Environment:', process.env.NODE_ENV);

// Updated CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://lebaincodefront-d2j7aye5k-jayzhehs-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Session middleware with MongoStore
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : 'localhost'
  }
}));

// Passport configuration
const callbackURL = process.env.NODE_ENV === 'production'
  ? 'https://lebaincode-backend.onrender.com/api/auth/github/callback'
  : 'http://localhost:5000/api/auth/github/callback';

// Store callbackURL in app settings
app.set('callbackURL', callbackURL);

// Passport configuration
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL,
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', require('./routes/auth'));

//Server running check
app.get('/', (req, res) => {
  res.send('LBC backend is running!');
});

// User profile route with error handling
const authMiddleware = require('./middleware/auth');
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
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// MongoDB connection with better error handling
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});