// routes/auth.js
const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GitHub auth routes
router.get('/github', (req, res, next) => {
  console.log('Redirecting to GitHub with redirect_uri:', req.app.get('callbackURL'));
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

      // Fix the redirect URL based on environment
      const frontendURL = process.env.NODE_ENV === 'production'
        ? 'https://lebaincodefront-d2j7aye5k-jayzhehs-projects.vercel.app'
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
    
    const user = await User.findOne({ username });
    if (!user || user.role !== 'admin') {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

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
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;