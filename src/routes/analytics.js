// routes/analytics.js
const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');
const verifyToken = require('../middleware/verifyToken');
const { checkRole } = require('../middleware/checkRoleAccess');

/**
 * @swagger
 * /api/admin/analytics/track:
 *   post:
 *     summary: Track page view
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               path:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Analytics tracked
 *       500:
 *         description: Server error
 */
router.post('/track', async (req, res) => {
  try {
    const { path, duration } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find or create analytics for today
    let analytics = await Analytics.findOne({ 
      date: { 
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      } 
    });
    
    if (!analytics) {
      analytics = new Analytics({ date: today });
    }
    
    // Add page view
    analytics.pageViews.push({
      path,
      duration,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      sessionId: req.sessionID || null
    });
    
    // Update total visits
    analytics.totalVisits += 1;
    
    // Update most visited pages
    const pageIndex = analytics.mostVisitedPages.findIndex(page => page.path === path);
    if (pageIndex >= 0) {
      analytics.mostVisitedPages[pageIndex].count += 1;
    } else {
      analytics.mostVisitedPages.push({ path, count: 1 });
    }
    
    // Sort most visited pages
    analytics.mostVisitedPages.sort((a, b) => b.count - a.count);
    
    await analytics.save();
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    res.status(500).json({ success: false, message: 'Error tracking analytics' });
  }
});

/**
 * @swagger
 * /api/admin/analytics/data:
 *   get:
 *     summary: Get analytics data (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/data', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    // Get analytics data from the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const analyticsData = await Analytics.find({
      date: { $gte: thirtyDaysAgo }
    }).sort({ date: -1 });
    
    res.status(200).json({ 
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error getting analytics data:', error);
    res.status(500).json({ success: false, message: 'Error retrieving analytics data' });
  }
});

/**
 * @swagger
 * /api/admin/analytics/frontend-data:
 *   get:
 *     summary: Get analytics data for frontend (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Frontend analytics data retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/frontend-data', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    // Get analytics data from the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const analyticsData = await Analytics.find({
      date: { $gte: thirtyDaysAgo }
    }).sort({ date: 1 });
    
    // Process data for frontend visualization
    const dailyVisits = analyticsData.map(day => ({
      date: day.date.toISOString().split('T')[0],
      visits: day.totalVisits,
      uniqueVisitors: day.uniqueVisitors || Math.floor(day.totalVisits * 0.7) // Estimate if not stored
    }));
    
    // Get most popular pages
    const pageVisits = {};
    analyticsData.forEach(day => {
      day.mostVisitedPages.forEach(page => {
        if (!pageVisits[page.path]) {
          pageVisits[page.path] = 0;
        }
        pageVisits[page.path] += page.count;
      });
    });
    
    const popularPages = Object.entries(pageVisits)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.status(200).json({ 
      success: true,
      dailyVisits,
      popularPages
    });
  } catch (error) {
    console.error('Error getting frontend analytics data:', error);
    res.status(500).json({ success: false, message: 'Error retrieving frontend analytics data' });
  }
});

module.exports = router;
