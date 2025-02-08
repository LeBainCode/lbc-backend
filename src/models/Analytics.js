// models/Analytics.js
const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  userAgent: String,
  ip: String,
  sessionId: String,
  duration: Number
});

const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  pageViews: [pageViewSchema],
  totalVisits: {
    type: Number,
    default: 0
  },
  uniqueVisitors: {
    type: Number,
    default: 0
  },
  mostVisitedPages: [{
    path: String,
    count: Number
  }]
});

module.exports = mongoose.model('Analytics', analyticsSchema);