// src/routes/email.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prospect = require('../models/Prospect');
const authMiddleware = require('../middleware/auth');

// Debug middleware: log each request to this router
router.use((req, res, next) => {
  console.log('Email Route:', req.method, req.path);
  console.log('Request body:', req.body);
  next();
});

/*
  GET /api/email/all
  - Retrieves all user emails (admin only)
*/
router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    const users = await User.find({}, 'email username githubId role')
      .sort({ createdAt: -1 })
      .exec();
    const usersWithEmail = users.filter(user => user.email);
    console.log(`Retrieved ${usersWithEmail.length} user emails`);
    res.json({
      success: true,
      count: usersWithEmail.length,
      users: usersWithEmail.map(user => ({
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        hasGithub: !!user.githubId
      }))
    });
  } catch (error) {
    console.error('Error retrieving user emails:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user emails',
      details: error.message 
    });
  }
});

/*
  GET /api/email/users/public
  - Retrieves user emails without requiring admin authentication
  - Limited fields for security and pagination for performance
*/
router.get('/users/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const users = await User.find({}, 'email username createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
      
    const usersWithEmail = users.filter(user => user.email);
    const total = await User.countDocuments({ email: { $exists: true, $ne: null } });
    
    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users: usersWithEmail.map(user => ({
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Error retrieving public user emails:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user emails',
      details: error.message 
    });
  }
});

/*
  GET /api/email/users/:username
  - Retrieves a specific user's email by username
*/
router.get('/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }, 'email username');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        username: user.username,
        email: user.email || null
      }
    });
  } catch (error) {
    console.error('Error retrieving user email:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user email',
      details: error.message 
    });
  }
});

/*
  GET /api/email/prospects/public
  - Retrieves prospect emails without requiring admin authentication
  - Includes pagination
*/
router.get('/prospects/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const prospects = await Prospect.find({}, 'email type createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
      
    const total = await Prospect.countDocuments();
    
    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      prospects: prospects.map(prospect => ({
        email: prospect.email,
        type: prospect.type,
        createdAt: prospect.createdAt
      }))
    });
  } catch (error) {
    console.error('Error retrieving public prospect emails:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve prospect emails',
      details: error.message 
    });
  }
});

/*
  GET /api/email/prospects/:email
  - Checks if a specific prospect email exists
*/
router.get('/prospects/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const prospect = await Prospect.findOne({ email }, 'email createdAt');
    
    if (!prospect) {
      return res.json({ exists: false });
    }
    
    res.json({
      exists: true,
      prospect: {
        email: prospect.email,
        createdAt: prospect.createdAt
      }
    });
  } catch (error) {
    console.error('Error checking prospect email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/*
  GET /api/email/settings-data
  - Retrieves combined email data needed for frontend settings pages
*/
router.get('/settings-data', async (req, res) => {
  try {
    // Get recent users with emails
    const users = await User.find({ email: { $exists: true, $ne: null } }, 'email username createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
      
    // Get recent prospects
    const prospects = await Prospect.find({}, 'email type createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
      
    res.json({
      success: true,
      users: users.map(user => ({
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      })),
      prospects: prospects.map(prospect => ({
        email: prospect.email,
        type: prospect.type,
        createdAt: prospect.createdAt
      }))
    });
  } catch (error) {
    console.error('Error retrieving settings data:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve settings data',
      details: error.message 
    });
  }
});

/*
  POST /api/email/check-user
  - Check if an email exists in the User collection
*/
router.post('/check-user', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ email });
    res.json({
      exists: !!user,
      username: user ? user.username : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/*
  POST /api/email/check-prospect
  - Check if an email exists in the Prospect collection
*/
router.post('/check-prospect', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const prospect = await Prospect.findOne({ email });
    res.json({ exists: !!prospect });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/*
  POST /api/email/check
  - Combined check: Looks for the email in both User and Prospect collections
*/
router.post('/check', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ email });
    const prospect = await Prospect.findOne({ email });
    res.json({
      exists: !!(user || prospect),
      inUserCollection: !!user,
      inProspectCollection: !!prospect,
      username: user ? user.username : null
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ 
      error: 'Server error checking email',
      details: error.message 
    });
  }
});

/*
  POST /api/email/prospect
  - Saves a new prospect email
*/
router.post('/prospect', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Received prospect email:', email);
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if email already exists before saving
    const existingProspect = await Prospect.findOne({ email });
    if (existingProspect) {
      // Email already exists, return success without creating duplicate
      return res.json({ 
        success: true, 
        message: 'Email already registered as prospect',
        alreadyExists: true
      });
    }
    
    // Email doesn't exist, save it
    const prospect = new Prospect({ email, createdAt: new Date() });
    await prospect.save();
    console.log('Prospect email saved:', email);
    
    res.json({ 
      success: true, 
      message: 'Email saved successfully',
      alreadyExists: false
    });
  } catch (error) {
    console.error('Error saving prospect email:', error);
    res.status(500).json({ 
      error: 'Failed to save prospect email',
      details: error.message 
    });
  }
});

/*
  POST /api/email/user
  - Saves a user's email without requiring them to be logged in
  - Useful for collecting emails from users before they fully register
*/
router.post('/user', async (req, res) => {
  try {
    const { email, username } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if email already exists
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res.status(409).json({ 
        error: 'Email already registered to a user',
        exists: true,
        username: existingEmailUser.username
      });
    }
    
    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the user's email
    existingUser.email = email;
    await existingUser.save();
    
    res.json({
      success: true,
      message: 'Email saved successfully',
      user: {
        username: existingUser.username,
        email: existingUser.email
      }
    });
  } catch (error) {
    console.error('Error saving user email:', error);
    res.status(500).json({ 
      error: 'Failed to save user email',
      details: error.message 
    });
  }
});

/*
  POST /api/email/users/bulk-update
  - Updates multiple user emails at once
  - Useful for settings pages where admins might batch update emails
*/
router.post('/users/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }
    
    const results = [];
    
    // Process each update sequentially to avoid race conditions
    for (const update of updates) {
      const { username, email } = update;
      
      if (!username || !email) {
        results.push({ 
          username, 
          success: false, 
          error: 'Username and email are required' 
        });
        continue;
      }
      
      try {
        const user = await User.findOne({ username });
        
        if (!user) {
          results.push({ 
            username, 
            success: false, 
            error: 'User not found' 
          });
          continue;
        }
        
        user.email = email;
        await user.save();
        
        results.push({
          username,
          email,
          success: true
        });
      } catch (updateError) {
        results.push({
          username,
          success: false,
          error: updateError.message
        });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error performing bulk email update:', error);
    res.status(500).json({ 
      error: 'Failed to update emails',
      details: error.message 
    });
  }
});

/*
  POST /api/email/update/me
  - Updates the authenticated user's own email
  - This route is defined before the generic update route to avoid conflicts with dynamic parameters.
*/
router.post('/update/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // ID from auth middleware
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    // Verify that no other user already uses the email
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) return res.status(409).json({ error: 'This email is already in use by another account' });
    const updatedUser = await User.findByIdAndUpdate(userId, { email }, { new: true, runValidators: true });
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    console.log(`User ${updatedUser.username} updated their email to ${email}`);
    res.json({
      success: true,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email
      },
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

/*
  POST /api/email/update/:userId
  - Updates a specific user's email (admin only or the user updating their own email)
*/
router.post('/update/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email } = req.body;
    if (!userId || !email) return res.status(400).json({ error: 'Both userId and email are required' });
    // Only allow if the authenticated user is updating their own email or if they are an admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only update your own email' });
    }
    const updatedUser = await User.findByIdAndUpdate(userId, { email }, { new: true, runValidators: true });
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json({
      success: true,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email
      },
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
