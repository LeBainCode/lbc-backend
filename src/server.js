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
const adminRoutes = require('./routes/admin');
const emailRoutes = require('./routes/email');

// Debug environment variables
console.log('GitHub Client ID:', process.env.GITHUB_CLIENT_ID);
console.log('Environment:', process.env.NODE_ENV);

// 1. Essential middleware
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://lebaincodefront-d2j7aye5k-jayzhehs-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Session configuration
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

// 3. Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// 4. Passport configuration
const callbackURL = process.env.NODE_ENV === 'production'
  ? 'https://lebaincode-backend.onrender.com/api/auth/github/callback'
  : 'http://localhost:5000/api/auth/github/callback';

app.set('callbackURL', callbackURL);

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

// 5. Routes
app.get('/', (req, res) => {
  res.send('LBC backend is running!');
});

// Middleware log
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const authMiddleware = require('./middleware/auth');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', adminRoutes);
app.use('/api', emailRoutes);

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

// 6. Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 7. Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// 8. Server startup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});