// routes/debugLogs.js
const express = require('express');
const router = express.Router();
const DebugLog = require('../models/DebugLog');
const { debug } = require('../utils/debugLogger');
const verifyToken = require('../middleware/verifyToken');
const { checkRole } = require('../middleware/checkRoleAccess');

/**
 * @swagger
 * tags:
 *   name: DebugLogs
 *   description: Debug logging and management
 */

/**
 * @swagger
 * /api/admin/debug-logs:
 *   get:
 *     summary: Get debug logs with filtering and pagination
 *     tags: [DebugLogs]
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
 *           default: 50
 *       - in: query
 *         name: component
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [frontend, backend]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Debug logs retrieved successfully
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      component, 
      level, 
      source,
      startDate,
      endDate,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build the filter query
    const query = {};
    
    if (component) query.component = component;
    if (level) query.level = level;
    if (source) query.source = source;
    
    // Add date range if provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    // Add text search if provided
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { component: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const logs = await DebugLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const totalCount = await DebugLog.countDocuments(query);
    
    // Get summary statistics
    const componentStats = await DebugLog.aggregate([
      { $group: { _id: "$component", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    const levelStats = await DebugLog.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const sourceStats = await DebugLog.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } }
    ]);
    
    // Log this access
    debug('DebugLogs', 'Admin accessed debug logs', { 
      adminId: req.user._id, 
      filters: req.query 
    }, { 
      level: 'info',
      persist: true 
    });
    
    res.json({
      success: true,
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: skip + logs.length < totalCount,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      },
      stats: {
        byComponent: componentStats,
        byLevel: levelStats,
        bySource: sourceStats
      }
    });
  } catch (error) {
    debug.error('DebugLogs', 'Error retrieving debug logs', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving debug logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/admin/debug-logs/log:
 *   post:
 *     summary: Create a new log entry from frontend
 *     tags: [DebugLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               component:
 *                 type: string
 *                 required: true
 *               message:
 *                 type: string
 *                 required: true
 *               level:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 default: debug
 *               data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Log created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/log', verifyToken, async (req, res) => {
  try {
    const { component, message, level = 'debug', data } = req.body;
    
    if (!component || !message) {
      return res.status(400).json({
        success: false,
        message: 'Component and message are required'
      });
    }
    
    // Create a new log entry
    const logEntry = new DebugLog({
      component,
      level,
      message,
      data,
      source: 'frontend',
      userId: req.user._id,
      sessionId: req.session?.id,
      requestInfo: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });
    
    await logEntry.save();
    
    res.status(201).json({
      success: true,
      message: 'Log created successfully',
      logId: logEntry._id
    });
  } catch (error) {
    debug.error('DebugLogs', 'Error creating log entry', error);
    res.status(500).json({
      success: false,
      message: 'Error creating log entry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/admin/debug-logs/clear:
 *   delete:
 *     summary: Clear debug logs (admin only)
 *     tags: [DebugLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: olderThan
 *         schema:
 *           type: integer
 *           description: Days - logs older than this many days will be deleted
 *       - in: query
 *         name: component
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logs cleared successfully
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.delete('/clear', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { olderThan, component } = req.query;
    
    const query = {};
    
    if (olderThan) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));
      query.timestamp = { $lt: cutoffDate };
    }
    
    if (component) {
      query.component = component;
    }
    
    // If no filters are provided, require confirmation
    if (!olderThan && !component) {
      const { confirm } = req.body;
      if (confirm !== 'DELETE_ALL_LOGS') {
        return res.status(400).json({
          success: false,
          message: 'To delete all logs, you must provide the confirmation code'
        });
      }
    }
    
    const result = await DebugLog.deleteMany(query);
    
    // Log this action (will be persisted, but not deleted by this operation)
    debug('DebugLogs', 'Admin cleared debug logs', { 
      adminId: req.user._id,
      deletedCount: result.deletedCount,
      filters: { olderThan, component }
    }, { 
      level: 'warn',
      persist: true,
      important: true
    });
    
    res.json({
      success: true,
      message: 'Logs cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    debug.error('DebugLogs', 'Error clearing logs', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/admin/debug-logs/components:
 *   get:
 *     summary: Get all unique component names
 *     tags: [DebugLogs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Components retrieved successfully
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/components', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const components = await DebugLog.distinct('component');
    
    res.json({
      success: true,
      components: components.sort()
    });
  } catch (error) {
    debug.error('DebugLogs', 'Error retrieving components', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving components',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
