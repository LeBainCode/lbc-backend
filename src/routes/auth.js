// routes/auth.js
const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GitHub auth routes
router.get('/github', (req, res, next) => {
  const callbackURL = req.app.get('callbackURL');
  console.log('Redirecting to GitHub with redirect_uri:', callbackURL);
  next();
}, passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Update frontend URL detection
      const frontendURL = process.env.NODE_ENV === 'production'
        ? 'https://lebaincodefront.vercel.app'  // Updated to your actual Vercel domain
        : 'http://localhost:3000';

      const redirectUrl = new URL('/dashboard', frontendURL);
      redirectUrl.searchParams.append('token', token);
      
      console.log('Redirecting to:', redirectUrl.toString());
      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Token generation error:', error);
      res.redirect('/auth-error');
    }
  }
);

// Admin login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Add logging for debugging
    console.log(`Login attempt for username: ${username}`);
    
    const user = await User.findOne({ username });
    if (!user || user.role !== 'admin') {
      console.log('Invalid credentials - user not found or not admin');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Invalid credentials - password mismatch');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Add response logging
    console.log(`Successful login for user: ${username}`);

    res.json({
      token,
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

// Add this route to your auth.js
router.get('/user/profile', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user data
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      githubId: user.githubId,
      progress: user.progress
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Add health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;