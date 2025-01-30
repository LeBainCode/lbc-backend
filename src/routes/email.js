// src/routes/email.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prospect = require('../models/Prospect');
const authMiddleware = require('../middleware/auth');

// Add this debug middleware
router.use((req, res, next) => {
  console.log('Email Route:', req.method, req.path);
  console.log('Request body:', req.body);
  next();
});

// Check if email exists in User collection
router.post('/users/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    res.json({
      exists: !!user,
      username: user ? user.username : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if email exists in Prospects collection
router.post('/prospects/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    const prospect = await Prospect.findOne({ email });
    res.json({ exists: !!prospect });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/prospects/email', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Received email:', email);
    
    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const prospect = new Prospect({
      email: email,
      createdAt: new Date()
    });

    await prospect.save();
    console.log('Prospect email saved:', email);
    
    res.json({ 
      success: true, 
      message: 'Email saved successfully'
    });
  } catch (error) {
    console.error('Error saving prospect email:', error);
    res.status(500).json({ 
      error: 'Failed to save prospect email',
      details: error.message 
    });
  }
});

// Update the route path to include /api prefix
router.post('/users/:userId/email', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email } = req.body;

    // Set proper headers
    res.setHeader('Content-Type', 'application/json');

    if (!userId || !email) {
      return res.status(400).json({ 
        error: 'Both userId and email are required' 
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    res.json({ 
      success: true, 
      user: updatedUser,
      message: 'Email updated successfully' 
    });

  } catch (error) {
    console.error('Error updating user email:', error);
    res.status(500).json({ 
      error: 'Failed to update user email',
      details: error.message 
    });
  }
});

module.exports = router;