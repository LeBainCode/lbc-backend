// src/routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prospect = require('../models/Prospect'); // Add this import
const jwt = require('jsonwebtoken');

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
            { type },
            { new: true }
        );
        if (!prospect) {
            return res.status(404).json({ message: 'Prospect not found' });
        }
        res.json(prospect);
    } catch (error) {
        console.error('Error updating prospect type:', error);
        res.status(500).json({ message: 'Error updating prospect type' });
    }
});

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

module.exports = router;