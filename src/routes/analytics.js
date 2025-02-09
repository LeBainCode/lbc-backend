// routes/analytics.js
const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');
const adminMiddleware = require('../middleware/auth');
const verifyToken = require('../middleware/auth');

// Track page views
let pageViews = {};
let sessionDurations = [];

// Track page view
router.post('/track', async (req, res) => {
  try {
    const { path, duration } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await Analytics.findOne({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (!analytics) {
      analytics = new Analytics();
    }

    analytics.pageViews.push({
      path,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      sessionId: req.sessionID
    });

    analytics.totalVisits += 1;
    await analytics.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track analytics' });
  }
});

// Get analytics data (admin only)
router.get('/data', adminMiddleware, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analyticsData = await Analytics.aggregate([
      {
        $match: {
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: '$totalVisits' },
          pageViews: { $push: '$pageViews' },
        }
      }
    ]);

    // Calculate most visited pages
    const pageVisits = {};
    analyticsData[0].pageViews.flat().forEach(view => {
      pageVisits[view.path] = (pageVisits[view.path] || 0) + 1;
    });

    const mostVisitedPages = Object.entries(pageVisits)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      totalVisits: analyticsData[0].totalVisits,
      mostVisitedPages
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

router.get('/frontend-data', verifyToken, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }

  try {
    const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
      const analyticsData = await Analytics.aggregate([
        {
          $match: {
            date: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: '$totalVisits' },
            uniqueVisitors: { $sum: '$uniqueVisitors' },
            averageSessionDuration: { $avg: '$averageSessionDuration' },
            bounceRate: { $avg: '$bounceRate' },
            pageViews: { $push: '$pageViews' },
          }
        }
      ]);
  
      res.json({
        totalVisits: analyticsData[0].totalVisits,
        uniqueVisitors: analyticsData[0].uniqueVisitors,
        averageSessionDuration: analyticsData[0].averageSessionDuration,
        bounceRate: analyticsData[0].bounceRate,
        mostVisitedPages: analyticsData[0].pageViews
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
  });

module.exports = router;