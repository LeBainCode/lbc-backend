// routes/prospectConversions.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Prospect = require('../models/Prospect');
const ProspectConversion = require('../models/ProspectConversion');
const { checkRole } = require('../middleware/checkRoleAccess');
const verifyToken = require('../middleware/verifyToken');

/**
 * @swagger
 * tags:
 *   name: ProspectConversions
 *   description: Prospect to user conversion management
 */

/**
 * @swagger
 * /api/admin/prospect-conversions/potential:
 *   get:
 *     summary: Find prospects that match user emails (potential conversions)
 *     tags: [ProspectConversions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Potential conversions found
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/potential', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        console.log('Finding potential prospect conversions...');
        
        // Get all prospects
        const prospects = await Prospect.find({}).lean();
        console.log(`Found ${prospects.length} total prospects`);
        
        // Get all users with emails
        const users = await User.find({ 
            email: { $exists: true, $ne: null } 
        }).select('username email role githubProfile createdAt').lean();
        console.log(`Found ${users.length} users with emails`);
        
        // Find matches where prospect email equals user email
        const potentialConversions = [];
        
        for (const prospect of prospects) {
            const matchingUser = users.find(user => 
                user.email && user.email.toLowerCase() === prospect.email.toLowerCase()
            );
            
            if (matchingUser) {
                // Check if this conversion already exists
                const existingConversion = await ProspectConversion.findByEmail(prospect.email);
                
                if (!existingConversion) {
                    potentialConversions.push({
                        prospect: {
                            email: prospect.email,
                            type: prospect.type,
                            reachedOut: prospect.reachedOut,
                            comment: prospect.comment,
                            createdAt: prospect.createdAt
                        },
                        user: {
                            id: matchingUser._id,
                            username: matchingUser.username,
                            email: matchingUser.email,
                            role: matchingUser.role,
                            githubProfile: matchingUser.githubProfile,
                            createdAt: matchingUser.createdAt
                        },
                        match: {
                            daysFromProspectToUser: Math.floor(
                                (new Date(matchingUser.createdAt) - new Date(prospect.createdAt)) / (1000 * 60 * 60 * 24)
                            ),
                            canConvert: true
                        }
                    });
                }
            }
        }
        
        console.log(`Found ${potentialConversions.length} potential conversions`);
        
        // Apply pagination
        const totalCount = potentialConversions.length;
        const paginatedResults = potentialConversions
            .sort((a, b) => new Date(b.prospect.createdAt) - new Date(a.prospect.createdAt))
            .slice(skip, skip + parseInt(limit));
        
        res.json({
            success: true,
            potentialConversions: paginatedResults,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: skip + paginatedResults.length < totalCount,
                hasPrevPage: page > 1,
                limit: parseInt(limit)
            },
            summary: {
                totalPotentialConversions: totalCount,
                totalProspects: prospects.length,
                totalUsersWithEmails: users.length
            }
        });
    } catch (error) {
        console.error('Error finding potential conversions:', error);
        res.status(500).json({
            success: false,
            message: 'Error finding potential conversions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospect-conversions/convert/{email}:
 *   post:
 *     summary: Convert a prospect to a user conversion record
 *     tags: [ProspectConversions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email of the prospect to convert
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversionReason:
 *                 type: string
 *                 enum: [email_match, user_registered, admin_decision, duplicate_cleanup]
 *                 default: email_match
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Prospect converted successfully
 *       400:
 *         description: Invalid request or conversion not possible
 *       404:
 *         description: Prospect or matching user not found
 *       409:
 *         description: Conversion already exists
 *       500:
 *         description: Server error
 */
router.post('/convert/:email', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { email } = req.params;
        const { conversionReason = 'email_match', notes = '' } = req.body;
        
        console.log(`Converting prospect with email: ${email}`);
        
        // Find the prospect
        const prospect = await Prospect.findOne({ email: email.toLowerCase().trim() });
        if (!prospect) {
            return res.status(404).json({
                success: false,
                message: 'Prospect not found'
            });
        }
        
        // Find matching user
        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('username email role githubProfile createdAt');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No matching user found for this email'
            });
        }
        
        // Check if conversion already exists
        const existingConversion = await ProspectConversion.findByEmail(email);
        if (existingConversion) {
            return res.status(409).json({
                success: false,
                message: 'Conversion already exists for this email',
                existingConversion: existingConversion.getConversionSummary()
            });
        }
        
        // Calculate days from prospect to user registration
        const daysFromProspectToUser = Math.max(0, Math.floor(
            (new Date(user.createdAt) - new Date(prospect.createdAt)) / (1000 * 60 * 60 * 24)
        ));
        
        // Create conversion record
        const conversionData = {
            originalProspect: {
                email: prospect.email,
                type: prospect.type,
                reachedOut: prospect.reachedOut,
                comment: prospect.comment,
                prospectCreatedAt: prospect.createdAt,
                lastUpdatedBy: prospect.lastUpdatedBy
            },
            convertedUser: {
                userId: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                githubProfile: user.githubProfile,
                userCreatedAt: user.createdAt
            },
            conversion: {
                convertedAt: new Date(),
                convertedBy: req.user._id,
                conversionType: 'manual',
                conversionReason,
                notes
            },
            analytics: {
                daysFromProspectToConversion: daysFromProspectToUser,
                wasReachedOut: prospect.reachedOut,
                prospectType: prospect.type
            }
        };
        
        // Start transaction to ensure data consistency
        const session = await ProspectConversion.startSession();
        session.startTransaction();
        
        try {
            // Create conversion record
            const conversion = new ProspectConversion(conversionData);
            await conversion.save({ session });
            
            // Remove from prospects collection
            await Prospect.deleteOne({ email: prospect.email }, { session });
            
            await session.commitTransaction();
            
            console.log(`Prospect conversion completed: ${email} → User ${user.username}`);
            
            res.json({
                success: true,
                message: 'Prospect converted successfully',
                conversion: {
                    id: conversion._id,
                    email: conversion.originalProspect.email,
                    username: conversion.convertedUser.username,
                    conversionDate: conversion.conversion.convertedAt,
                    daysTaken: conversion.analytics.daysFromProspectToConversion,
                    wasReachedOut: conversion.analytics.wasReachedOut,
                    conversionReason: conversion.conversion.conversionReason
                }
            });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('Error converting prospect:', error);
        res.status(500).json({
            success: false,
            message: 'Error converting prospect',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospect-conversions:
 *   get:
 *     summary: Get all prospect conversions with filtering
 *     tags: [ProspectConversions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: prospectType
 *         schema:
 *           type: string
 *           enum: [individual, organization, other, all]
 *           default: all
 *       - in: query
 *         name: wasReachedOut
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: all
 *       - in: query
 *         name: conversionReason
 *         schema:
 *           type: string
 *           enum: [email_match, user_registered, admin_decision, duplicate_cleanup, all]
 *           default: all
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [convertedAt, daysToConvert, email, username]
 *           default: convertedAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [desc, asc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Conversions retrieved successfully
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            prospectType = 'all',
            wasReachedOut = 'all',
            conversionReason = 'all',
            sortBy = 'convertedAt',
            order = 'desc'
        } = req.query;
        
        const skip = (page - 1) * limit;
        
        // Build query
        let query = {};
        
        if (prospectType !== 'all') {
            query['analytics.prospectType'] = prospectType;
        }
        
        if (wasReachedOut !== 'all') {
            query['analytics.wasReachedOut'] = wasReachedOut === 'true';
        }
        
        if (conversionReason !== 'all') {
            query['conversion.conversionReason'] = conversionReason;
        }
        
        // Build sort object
        const sortFields = {
            convertedAt: 'conversion.convertedAt',
            daysToConvert: 'analytics.daysFromProspectToConversion',
            email: 'originalProspect.email',
            username: 'convertedUser.username'
        };
        
        const sortObject = {};
        sortObject[sortFields[sortBy] || sortFields.convertedAt] = order === 'desc' ? -1 : 1;
        
        // Get conversions
        const conversions = await ProspectConversion.find(query)
            .populate('conversion.convertedBy', 'username')
            .sort(sortObject)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const totalCount = await ProspectConversion.countDocuments(query);
        
        // Format conversions for response
        const formattedConversions = conversions.map(conversion => ({
            id: conversion._id,
            prospect: {
                email: conversion.originalProspect.email,
                type: conversion.originalProspect.type,
                reachedOut: conversion.originalProspect.reachedOut,
                comment: conversion.originalProspect.comment,
                createdAt: conversion.originalProspect.prospectCreatedAt
            },
            user: {
                id: conversion.convertedUser.userId,
                username: conversion.convertedUser.username,
                email: conversion.convertedUser.email,
                role: conversion.convertedUser.role,
                createdAt: conversion.convertedUser.userCreatedAt
            },
            conversion: {
                convertedAt: conversion.conversion.convertedAt,
                convertedBy: conversion.conversion.convertedBy,
                conversionReason: conversion.conversion.conversionReason,
                notes: conversion.conversion.notes
            },
            analytics: {
                daysFromProspectToConversion: conversion.analytics.daysFromProspectToConversion,
                wasReachedOut: conversion.analytics.wasReachedOut,
                prospectType: conversion.analytics.prospectType
            }
        }));
        
        res.json({
            success: true,
            conversions: formattedConversions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: skip + conversions.length < totalCount,
                hasPrevPage: page > 1,
                limit: parseInt(limit)
            },
            filters: {
                prospectType,
                wasReachedOut,
                conversionReason,
                sortBy,
                order
            }
        });
    } catch (error) {
        console.error('Error fetching prospect conversions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching prospect conversions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospect-conversions/stats:
 *   get:
 *     summary: Get prospect conversion statistics
 *     tags: [ProspectConversions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversion statistics retrieved
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/stats', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        console.log('Fetching prospect conversion statistics...');
        
        // Get conversion statistics
        const stats = await ProspectConversion.getConversionStats();
        
        // Get recent conversion trends (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentConversions = await ProspectConversion.find({
            'conversion.convertedAt': { $gte: thirtyDaysAgo }
        }).select('conversion.convertedAt analytics.daysFromProspectToConversion analytics.wasReachedOut');
        
        // Group by date for trending
        const conversionsByDate = {};
        recentConversions.forEach(conversion => {
            const date = conversion.conversion.convertedAt.toISOString().split('T')[0];
            if (!conversionsByDate[date]) {
                conversionsByDate[date] = {
                    count: 0,
                    totalDays: 0,
                    reachedOutCount: 0
                };
            }
            conversionsByDate[date].count++;
            conversionsByDate[date].totalDays += conversion.analytics.daysFromProspectToConversion;
            if (conversion.analytics.wasReachedOut) {
                conversionsByDate[date].reachedOutCount++;
            }
        });
        
        // Format trending data
        const trendingData = Object.entries(conversionsByDate).map(([date, data]) => ({
            date,
            conversions: data.count,
            avgDaysToConvert: Math.round(data.totalDays / data.count),
            reachedOutPercentage: Math.round((data.reachedOutCount / data.count) * 100)
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Get conversion efficiency metrics
        const totalProspects = await Prospect.countDocuments();
        const totalConversions = stats.overall.totalConversions;
        const conversionRate = totalProspects > 0 ? ((totalConversions / (totalConversions + totalProspects)) * 100).toFixed(2) : 0;
        
        res.json({
            success: true,
            stats: {
                ...stats,
                conversionRate: parseFloat(conversionRate),
                totalCurrentProspects: totalProspects,
                recentTrends: trendingData
            }
        });
    } catch (error) {
        console.error('Error fetching conversion statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching conversion statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospect-conversions/{id}/reverse:
 *   delete:
 *     summary: Reverse a prospect conversion (move back to prospects)
 *     tags: [ProspectConversions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversion ID to reverse
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for reversing the conversion
 *     responses:
 *       200:
 *         description: Conversion reversed successfully
 *       404:
 *         description: Conversion not found
 *       409:
 *         description: Cannot reverse - prospect email already exists
 *       500:
 *         description: Server error
 */
router.delete('/:id/reverse', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason = 'Admin decision to reverse conversion' } = req.body;
        
        console.log(`Reversing conversion: ${id}`);
        
        // Find the conversion
        const conversion = await ProspectConversion.findById(id);
        if (!conversion) {
            return res.status(404).json({
                success: false,
                message: 'Conversion not found'
            });
        }
        
        // Check if prospect with this email already exists
        const existingProspect = await Prospect.findOne({ 
            email: conversion.originalProspect.email 
        });
        
        if (existingProspect) {
            return res.status(409).json({
                success: false,
                message: 'Cannot reverse conversion - prospect with this email already exists',
                existingProspect: {
                    email: existingProspect.email,
                    createdAt: existingProspect.createdAt
                }
            });
        }
        
        // Start transaction
        const session = await ProspectConversion.startSession();
        session.startTransaction();
        
        try {
            // Recreate prospect from conversion data
            const prospectData = {
                email: conversion.originalProspect.email,
                type: conversion.originalProspect.type,
                reachedOut: conversion.originalProspect.reachedOut,
                comment: conversion.originalProspect.comment + 
                    ` [RESTORED from conversion on ${new Date().toISOString()}: ${reason}]`,
                createdAt: conversion.originalProspect.prospectCreatedAt,
                lastUpdatedBy: {
                    ...conversion.originalProspect.lastUpdatedBy,
                    restored: {
                        admin: req.user.username,
                        timestamp: new Date(),
                        reason: reason
                    }
                }
            };
            
            const restoredProspect = new Prospect(prospectData);
            await restoredProspect.save({ session });
            
            // Remove conversion record
            await ProspectConversion.deleteOne({ _id: id }, { session });
            
            await session.commitTransaction();
            
            console.log(`Conversion reversed successfully: ${conversion.originalProspect.email}`);
            
            res.json({
                success: true,
                message: 'Conversion reversed successfully',
                restoredProspect: {
                    email: restoredProspect.email,
                    type: restoredProspect.type,
                    reachedOut: restoredProspect.reachedOut,
                    originalCreatedAt: restoredProspect.createdAt,
                    restoredAt: new Date()
                }
            });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('Error reversing conversion:', error);
        res.status(500).json({
            success: false,
            message: 'Error reversing conversion',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /api/admin/prospect-conversions/{id}:
 *   get:
 *     summary: Get detailed information about a specific conversion
 *     tags: [ProspectConversions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversion ID
 *     responses:
 *       200:
 *         description: Conversion details retrieved
 *       404:
 *         description: Conversion not found
 *       500:
 *         description: Server error
 */
router.get('/:id', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const conversion = await ProspectConversion.findById(id)
            .populate('conversion.convertedBy', 'username email')
            .populate('convertedUser.userId', 'username email role progress createdAt');
        
        if (!conversion) {
            return res.status(404).json({
                success: false,
                message: 'Conversion not found'
            });
        }
        
        res.json({
            success: true,
            conversion: {
                id: conversion._id,
                originalProspect: conversion.originalProspect,
                convertedUser: conversion.convertedUser,
                conversion: conversion.conversion,
                analytics: conversion.analytics,
                summary: conversion.getConversionSummary(),
                createdAt: conversion.createdAt,
                updatedAt: conversion.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching conversion details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching conversion details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;