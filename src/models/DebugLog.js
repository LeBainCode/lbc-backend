// models/DebugLog.js
const mongoose = require('mongoose');

const debugLogSchema = new mongoose.Schema({
  component: {
    type: String,
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['debug', 'info', 'warn', 'error'],
    default: 'debug',
    index: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  source: {
    type: String,
    enum: ['frontend', 'backend'],
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  requestInfo: {
    method: String,
    path: String,
    query: Object,
    ip: String,
    userAgent: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Add index for efficient querying by date range
debugLogSchema.index({ timestamp: -1 });

// Add compound indexes for common query patterns
debugLogSchema.index({ component: 1, level: 1, timestamp: -1 });
debugLogSchema.index({ source: 1, level: 1, timestamp: -1 });

module.exports = mongoose.model('DebugLog', debugLogSchema);
