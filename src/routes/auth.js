// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// GitHub OAuth callback route
router.get('/github/callback', async (req, res) => {
  try {
    const { id: githubId } = req.user._json;

    // Find the latest user number
    const latestUser = await User.findOne({ role: 'user' })
      .sort({ username: -1 });
    
    // Generate new user number (001, 002, etc.)
    const newUserNumber = latestUser 
      ? String(Number(latestUser.username) + 1).padStart(3, '0')
      : '001';

    // Create or update user
    let user = await User.findOneAndUpdate(
      { githubId },
      {
        username: newUserNumber,
        role: 'user',
        progress: {
          cModule: { completed: 0, total: 10 },
          examModule: { completed: 0, total: 4, isUnlocked: false }
        }
      },
      { upsert: true, new: true }
    );

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth-error`);
  }
});

module.exports = router;