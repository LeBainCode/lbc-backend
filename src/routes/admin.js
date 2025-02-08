// src/routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prospect = require('../models/Prospect'); 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Admin middleware
const adminMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(401).json({ message: 'Invalid token or unauthorized' });
    }
};

// Get user count endpoint
router.get('/users/count', adminMiddleware, async (req, res) => {
    try {
        const userCount = await User.countDocuments({ role: 'user' });
        res.json({ count: userCount });
    } catch (error) {
        console.error('Error fetching user count:', error);
        res.status(500).json({ message: 'Error fetching user count' });
    }
});

// Get all prospects with sorting and filtering
router.get('/prospects', adminMiddleware, async (req, res) => {
    try {
        const prospects = await Prospect.find()
            .sort({ createdAt: -1 }); // Sort by most recent first
        res.json(prospects);
    } catch (error) {
        console.error('Error fetching prospects:', error);
        res.status(500).json({ message: 'Error fetching prospects' });
    }
});

// Update prospect type
router.put('/prospects/:email/type', adminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        const { type } = req.body;
        const prospect = await Prospect.findOneAndUpdate(
            { email },
            { 
                type,
                'lastUpdatedBy.type': {
                    admin: req.user.username,
                    timestamp: new Date()
                }
            },
            { new: true }
        );
        res.json(prospect);
    } catch (error) {
        res.status(500).json({ message: 'Error updating prospect type' });
    }
});

// Similar updates for reached out and comment routes...

// Update reached out status
router.put('/prospects/:email/reached-out', adminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        const { reachedOut } = req.body;
        const prospect = await Prospect.findOneAndUpdate(
            { email },
            { reachedOut },
            { new: true }
        );
        if (!prospect) {
            return res.status(404).json({ message: 'Prospect not found' });
        }
        res.json(prospect);
    } catch (error) {
        console.error('Error updating reached out status:', error);
        res.status(500).json({ message: 'Error updating reached out status' });
    }
});

// Update comment
router.put('/prospects/:email/comment', adminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        const { comment } = req.body;
        const prospect = await Prospect.findOneAndUpdate(
            { email },
            { comment },
            { new: true }
        );
        if (!prospect) {
            return res.status(404).json({ message: 'Prospect not found' });
        }
        res.json(prospect);
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ message: 'Error updating comment' });
    }
});

// Get all regular users
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({ 
            role: 'user' 
        })
        .select('username email createdAt')
        .sort({ createdAt: -1 });
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Enable beta access for a user
router.post('/users/:userId/beta', adminMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      user.role = 'beta';
      user.betaAccess = {
        isEnabled: true,
        enabledAt: new Date(),
        enabledBy: req.user._id
      };
      await user.save();
  
      res.json({ 
        message: 'Beta access granted successfully',
        user: {
          username: user.username,
          role: user.role,
          betaAccess: user.betaAccess
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error enabling beta access' });
    }
  });
  
  // Get beta users
  router.get('/users/beta', adminMiddleware, async (req, res) => {
    try {
      const betaUsers = await User.find({ role: 'beta' })
        .select('username email createdAt betaAccess')
        .sort({ 'betaAccess.enabledAt': -1 });
      
      res.json(betaUsers);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching beta users' });
    }
  });

  // Get all admin users
router.get('/admins', adminMiddleware, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' })
            .select('username email createdAt lastLogin')
            .sort({ createdAt: -1 });
        
        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: 'Error fetching admin users' });
    }
});

// Create new admin user
router.post('/admins', adminMiddleware, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ 
                message: 'Username, email, and password are required' 
            });
        }

        // Check if username or email already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({ 
                message: 'Username or email already exists' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await User.create({
            username,
            email,
            password: hashedPassword,
            role: 'admin'
        });

        res.status(201).json({
            message: 'Admin user created successfully',
            admin: {
                username: newAdmin.username,
                email: newAdmin.email,
                createdAt: newAdmin.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: 'Error creating admin user' });
    }
});

// Update admin user
router.put('/admins/:adminId', adminMiddleware, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Prevent self-update of critical fields
        if (req.params.adminId === req.user.id && (username || email)) {
            return res.status(400).json({ 
                message: 'Cannot update your own username or email' 
            });
        }

        const adminToUpdate = await User.findOne({
            _id: req.params.adminId,
            role: 'admin'
        });

        if (!adminToUpdate) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        // Update fields if provided
        if (username) adminToUpdate.username = username;
        if (email) adminToUpdate.email = email;
        if (password) {
            adminToUpdate.password = await bcrypt.hash(password, 10);
        }

        await adminToUpdate.save();

        res.json({
            message: 'Admin user updated successfully',
            admin: {
                username: adminToUpdate.username,
                email: adminToUpdate.email,
                updatedAt: adminToUpdate.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating admin:', error);
        res.status(500).json({ message: 'Error updating admin user' });
    }
});

// Delete admin user
router.delete('/admins/:adminId', adminMiddleware, async (req, res) => {
    try {
        // Prevent self-deletion
        if (req.params.adminId === req.user.id) {
            return res.status(400).json({ 
                message: 'Cannot delete your own admin account' 
            });
        }

        const result = await User.deleteOne({ 
            _id: req.params.adminId,
            role: 'admin'
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        res.json({ message: 'Admin user deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Error deleting admin user' });
    }
});


module.exports = router;