// src/routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prospect = require('../models/Prospect'); 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations for user and prospect management
 */

// Admin middleware
const adminMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        console.log("Token from cookie:", token ? "Present" : "Missing");
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token userId:", decoded.userId);
        const user = await User.findById(decoded.userId);

        if (!user || user.role !== 'admin') {
            console.log("User not found or not admin:", { 
                userExists: !!user, 
                userRole: user?.role 
            });
            return res.status(403).json({ message: 'Admin access required' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(401).json({ message: 'Invalid token or unauthorized' });
    }
};

/**
 * @swagger
 * /api/admin/users/count:
 *   get:
 *     summary: Get total count of users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   example: 42
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/users/count', adminMiddleware, async (req, res) => {
    try {
        console.log('Fetching user count...');
        const userCount = await User.countDocuments({ role: 'user' });
        console.log('User count retrieved:', userCount);
        res.json({ count: userCount });
    } catch (error) {
        console.error('Error fetching user count:', error);
        res.status(500).json({ 
            message: 'Error fetching user count',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all regular users with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, beta, admin, all]
 *           default: user
 *         description: Filter by user role
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastLogin:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, role = 'user' } = req.query;
        const skip = (page - 1) * limit;
        
        console.log('Fetching users with params:', { page, limit, role, skip });
        
        // Build query
        let query = {};
        if (role !== 'all') {
            query.role = role;
        }
        
        console.log('User query:', query);
        
        // Get users with pagination
        const users = await User.find(query)
            .select('username email role createdAt security.lastLogin')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(); // Use lean() for better performance
        
        console.log(`Found ${users.length} users`);
        
        // Get total count
        const totalCount = await User.countDocuments(query);
        console.log('Total user count:', totalCount);
        
        // Format response
        const formattedUsers = users.map(user => ({
            _id: user._id,
            username: user.username,
            email: user.email || null,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: user.security?.lastLogin || null
        }));
        
        res.json({
            success: true,
            users: formattedUsers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: skip + users.length < totalCount,
                hasPrevPage: page > 1,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            message: 'Error fetching users',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===========================================
// PROSPECT MANAGEMENT
// ===========================================

/**
 * @swagger
 * /api/admin/prospects:
 *   get:
 *     summary: Get all prospects with filtering and sorting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of prospects per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [individual, organization, other, all]
 *           default: all
 *         description: Filter by prospect type
 *       - in: query
 *         name: reachedOut
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: all
 *         description: Filter by reached out status
 *     responses:
 *       200:
 *         description: List of prospects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 prospects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Prospect'
 *                 pagination:
 *                   type: object
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalProspects:
 *                       type: integer
 *                     reachedOutCount:
 *                       type: integer
 *                     notReachedOutCount:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/prospects', adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, type = 'all', reachedOut = 'all' } = req.query;
        const skip = (page - 1) * limit;
        
        // Build query
        let query = {};
        if (type !== 'all') {
            query.type = type;
        }
        if (reachedOut !== 'all') {
            query.reachedOut = reachedOut === 'true';
        }
        
        // Get prospects
        const prospects = await Prospect.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const totalCount = await Prospect.countDocuments(query);
        
        // Get stats
        const stats = {
            totalProspects: await Prospect.countDocuments(),
            reachedOutCount: await Prospect.countDocuments({ reachedOut: true }),
            notReachedOutCount: await Prospect.countDocuments({ reachedOut: false })
        };
        
        res.json({
            success: true,
            prospects,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: skip + prospects.length < totalCount,
                hasPrevPage: page > 1,
                limit: parseInt(limit)
            },
            stats
        });
    } catch (error) {
        console.error('Error fetching prospects:', error);
        res.status(500).json({ 
            message: 'Error fetching prospects',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospects/{email}/type:
 *   put:
 *     summary: Update the type of a prospect
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Prospect email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [individual, organization, other]
 *     responses:
 *       200:
 *         description: Prospect type updated successfully
 *       400:
 *         description: Invalid type provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Prospect not found
 *       500:
 *         description: Server error
 */
router.put('/prospects/:email/type', adminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        const { type } = req.body;
        
        if (!type || !['individual', 'organization', 'other'].includes(type)) {
            return res.status(400).json({ 
                message: 'Type must be one of: individual, organization, other' 
            });
        }
        
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
        
        if (!prospect) {
            return res.status(404).json({ message: 'Prospect not found' });
        }
        
        res.json({
            success: true,
            message: 'Prospect type updated successfully',
            prospect
        });
    } catch (error) {
        console.error('Error updating prospect type:', error);
        res.status(500).json({ 
            message: 'Error updating prospect type',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospects/{email}/reached-out:
 *   put:
 *     summary: Update reached out status of a prospect
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Prospect email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reachedOut
 *             properties:
 *               reachedOut:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid reachedOut value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Prospect not found
 *       500:
 *         description: Server error
 */
router.put('/prospects/:email/reached-out', adminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        const { reachedOut } = req.body;
        
        if (typeof reachedOut !== 'boolean') {
            return res.status(400).json({ 
                message: 'reachedOut must be a boolean value' 
            });
        }
        
        const prospect = await Prospect.findOneAndUpdate(
            { email },
            { 
                reachedOut,
                'lastUpdatedBy.reachedOut': {
                    admin: req.user.username,
                    timestamp: new Date()
                }
            },
            { new: true }
        );
        
        if (!prospect) {
            return res.status(404).json({ message: 'Prospect not found' });
        }
        
        res.json({
            success: true,
            message: 'Reached out status updated successfully',
            prospect
        });
    } catch (error) {
        console.error('Error updating reached out status:', error);
        res.status(500).json({ 
            message: 'Error updating reached out status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospects/{email}/comment:
 *   put:
 *     summary: Update comment for a prospect
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Prospect email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Invalid comment provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Prospect not found
 *       500:
 *         description: Server error
 */
router.put('/prospects/:email/comment', adminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        const { comment } = req.body;
        
        if (typeof comment !== 'string') {
            return res.status(400).json({ 
                message: 'Comment must be a string' 
            });
        }
        
        if (comment.length > 1000) {
            return res.status(400).json({ 
                message: 'Comment cannot exceed 1000 characters' 
            });
        }
        
        const prospect = await Prospect.findOneAndUpdate(
            { email },
            { 
                comment,
                'lastUpdatedBy.comment': {
                    admin: req.user.username,
                    timestamp: new Date()
                }
            },
            { new: true }
        );
        
        if (!prospect) {
            return res.status(404).json({ message: 'Prospect not found' });
        }
        
        res.json({
            success: true,
            message: 'Comment updated successfully',
            prospect
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ 
            message: 'Error updating comment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===========================================
// ADMIN USER MANAGEMENT
// ===========================================

/**
 * @swagger
 * /api/admin/admins:
 *   get:
 *     summary: Get all admin users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 admins:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastLogin:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new admin user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 12
 *                 description: Password must be at least 12 characters with uppercase, lowercase, number, and special character
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Server error
 */
router.get('/admins', adminMiddleware, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' })
            .select('username email createdAt security.lastLogin')
            .sort({ createdAt: -1 });
        
        const formattedAdmins = admins.map(admin => ({
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            createdAt: admin.createdAt,
            lastLogin: admin.security?.lastLogin || null
        }));
        
        res.json({
            success: true,
            count: admins.length,
            admins: formattedAdmins
        });
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ 
            message: 'Error fetching admin users',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/admins', adminMiddleware, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ 
                message: 'Username, email, and password are required' 
            });
        }

        // Validate password strength
        if (password.length < 12) {
            return res.status(400).json({ 
                message: 'Password must be at least 12 characters long' 
            });
        }

        if (!/[A-Z]/.test(password) || 
            !/[a-z]/.test(password) || 
            !/[0-9]/.test(password) || 
            !/[^A-Za-z0-9]/.test(password)) {
            return res.status(400).json({ 
                message: 'Password must include uppercase, lowercase, number, and special character' 
            });
        }

        // Check if username or email already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(409).json({ 
                message: 'Username or email already exists' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const newAdmin = await User.create({
            username,
            email,
            password: hashedPassword,
            role: 'admin'
        });

        res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            admin: {
                _id: newAdmin._id,
                username: newAdmin.username,
                email: newAdmin.email,
                role: newAdmin.role,
                createdAt: newAdmin.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ 
            message: 'Error creating admin user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/admins/{adminId}:
 *   put:
 *     summary: Update an admin user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 12
 *     responses:
 *       200:
 *         description: Admin updated successfully
 *       400:
 *         description: Invalid request or cannot update own critical fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete an admin user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin deleted successfully
 *       400:
 *         description: Cannot delete own account
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin not found
 *       500:
 *         description: Server error
 */
router.put('/admins/:adminId', adminMiddleware, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Prevent self-update of critical fields
        if (req.params.adminId === req.user._id.toString() && (username || email)) {
            return res.status(400).json({ 
                message: 'Cannot update your own username or email for security reasons' 
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
        if (username) {
            // Check if username is already taken
            const existingUser = await User.findOne({ 
                username, 
                _id: { $ne: req.params.adminId } 
            });
            if (existingUser) {
                return res.status(409).json({ message: 'Username already exists' });
            }
            adminToUpdate.username = username;
        }
        
        if (email) {
            // Check if email is already taken
            const existingUser = await User.findOne({ 
                email, 
                _id: { $ne: req.params.adminId } 
            });
            if (existingUser) {
                return res.status(409).json({ message: 'Email already exists' });
            }
            adminToUpdate.email = email;
        }
        
        if (password) {
            if (password.length < 12) {
                return res.status(400).json({ 
                    message: 'Password must be at least 12 characters long' 
                });
            }
            adminToUpdate.password = await bcrypt.hash(password, 12);
        }

        await adminToUpdate.save();

        res.json({
            success: true,
            message: 'Admin user updated successfully',
            admin: {
                _id: adminToUpdate._id,
                username: adminToUpdate.username,
                email: adminToUpdate.email,
                updatedAt: adminToUpdate.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating admin:', error);
        res.status(500).json({ 
            message: 'Error updating admin user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.delete('/admins/:adminId', adminMiddleware, async (req, res) => {
    try {
        // Prevent self-deletion
        if (req.params.adminId === req.user._id.toString()) {
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

        res.json({ 
            success: true,
            message: 'Admin user deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ 
            message: 'Error deleting admin user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;