/**
 * src/routes/auth.js
 *
 * This file defines the authentication routes for the application.
 * It includes routes for checking authentication, GitHub OAuth, local admin login,
 * logout, and session verification. In development, a test-user route is available.
 */

const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken'); // Middleware to verify JWT tokens

// Debug logger function to assist with logging inside routes.
const debug = (message, data) => {
  console.log(`[Auth Route] ${message}`, data || '');
};

/**
 * GET /check
 * Checks if the user is authenticated by verifying the JWT token stored in cookies.
 * Returns a JSON response indicating whether the user is authenticated and, if so, some user data.
 */
router.get('/check', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ authenticated: false, user: null });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findById(decoded.userId)
      .then(user => {
        if (!user) {
          return res.json({ authenticated: false, user: null });
        }
        res.json({
          authenticated: true,
          user: {
            id: user._id,
            username: user.username,
            role: user.role,
            progress: user.progress
          }
        });
      })
      .catch(err => {
        console.error('User lookup error:', err);
        res.json({ authenticated: false, user: null });
      });
  } catch (error) {
    console.error('Token verification error:', error);
    res.json({ authenticated: false, user: null });
  }
});

/**
 * GET /github
 * Starts the GitHub OAuth authentication flow.
 */
router.get('/github', (req, res, next) => {
  debug('Starting GitHub authentication');
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false
  })(req, res, next);
});

/**
 * GET /github/callback
 * Handles the callback from GitHub OAuth.
 * On success, it generates a JWT token, sets it as an HTTP-only cookie, and redirects the user to the dashboard.
 */
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
      // Generate JWT token for the authenticated user.
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      // Set the token in an HTTP-only cookie.
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // Cookie valid for 1 day.
      });
      // Redirect to the frontend's dashboard.
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      console.error('Token generation error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_failed`);
    }
  })(req, res, next);
});

/**
 * POST /login
 * Admin login route for local/form-based authentication.
 * Validates credentials, generates a JWT token, updates the user's login history,
 * and sets the token in an HTTP-only cookie.
 */
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
    // Generate a JWT token.
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    // Set the token in an HTTP-only cookie.
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day.
    });
    // Update user's login history.
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

/**
 * GET /user/profile
 * Fetches the authenticated user's detailed profile information.
 * Protected by the verifyToken middleware to ensure only authenticated users can access it.
 */
router.get('/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        progress: user.progress,
        security: user.security ? {
          lastLogin: user.security.lastLogin
        } : null
      }
    });
  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /verify-session
 * Protected route that verifies if the user is authenticated.
 * The verifyToken middleware checks the token, and if valid, the route returns the user data.
 */
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

/**
 * POST /logout
 * Logs out the user by clearing the authentication cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * Development-only routes.
 * These routes are only available when NODE_ENV is set to "development".
 */
if (process.env.NODE_ENV === 'development') {
  // Route to create a test user for development purposes.
  router.post('/test-user', async (req, res) => {
    try {
      const latestUser = await User.findOne({ role: 'user' }).sort({ username: -1 });
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

/**
 * GET /health
 * Health check route to verify that the API server is running.
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
