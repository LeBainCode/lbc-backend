// routes/auth.js
const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken'); // Import middleware

// Debug logger
const debug = (message, data) => {
  console.log(`[Auth Route] ${message}`, data || '');
};

// Auth check route
router.get('/check', verifyToken, (req, res) => {
  try {
    // Respond with the authenticated user's data
    res.json({
      authenticated: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        role: req.user.role,
        progress: req.user.progress,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/check:', error);
    res.status(500).json({ authenticated: false, message: 'Server error' });
  }
});

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
  debug('Starting GitHub authentication');
  passport.authenticate('github', { 
    scope: ['user:email'],
    session: false
  })(req, res, next);
});

// GitHub callback route 
router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    session: false,
  }, async (err, user) => {
    if (err) {
      console.error('GitHub callback error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    if (!user) {
      console.error('No user returned from GitHub');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
    }

    try {
      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Set token in HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });

      // Redirect to frontend dashboard
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      console.error('Token generation error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_failed`);
    }
  })(req, res, next);
});

// Admin login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || user.role !== 'admin') {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set token in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // Update login history
    user.security = {
      lastLogin: new Date(),
      loginHistory: [
        ...(user.security?.loginHistory || []),
        {
          timestamp: new Date(),
          provider: 'organizational',
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      ].slice(-5)
    };
    await user.save();

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        progress: user.progress
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify session route to check if the user is authenticated
router.get('/verify-session', verifyToken, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

// Logout route to clear the HTTP-only cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
});

// Development only routes
if (process.env.NODE_ENV === 'development') {
  router.post('/test-user', async (req, res) => {
    try {
      const latestUser = await User.findOne({ role: 'user' })
        .sort({ username: -1 });
      
      const newUserNumber = latestUser 
        ? String(Number(latestUser.username) + 1).padStart(3, '0')
        : '001';

      const testUser = await User.create({
        username: newUserNumber,
        githubId: `test${Date.now()}`,
        role: 'user',
        progress: {
          cModule: { completed: 0, total: 10 },
          examModule: { completed: 0, total: 4, isUnlocked: false }
        }
      });
      
      debug('Test user created', { username: testUser.username });
      res.json(testUser);
    } catch (err) {
      debug('Test user creation error', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// Verify session route
router.get('/verify-session', verifyToken, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;