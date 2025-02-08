// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    sparse: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^\S+@\S+\.\S+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: function() {
      return this.role === 'admin';
    },
    minlength: 8
  },
  
  // Authentication
  githubId: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // Role & Access
  role: {
    type: String,
    enum: ['user', 'beta', 'admin'],
    default: 'user'
  },
  
  // GitHub Profile Data
  githubProfile: {
    username: String,
    profileUrl: String,
    avatarUrl: String
  },
  
  // Progress Tracking
  progress: {
    cModule: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 10 }
    },
    examModule: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 4 },
      isUnlocked: { type: Boolean, default: false }
    }
  },
  
  // Beta Access
  betaAccess: {
    isEnabled: { type: Boolean, default: false },
    enabledAt: Date,
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Security & Tracking
  security: {
    lastLogin: Date,
    loginHistory: [{
      timestamp: Date,
      ip: String,
      userAgent: String
    }]
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);