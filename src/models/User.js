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
  // Legacy progress fields (keeping for backward compatibility)
  cModule: {
    completed: { type: Number, default: 0 },
    total: { type: Number, default: 10 }
  },
  examModule: {
    completed: { type: Number, default: 0 },
    total: { type: Number, default: 4 },
    isUnlocked: { type: Boolean, default: false }
  },
  
  // New module-based progress tracking
  modules: [{
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module'
    },
    started: {
      type: Boolean,
      default: false
    },
    startedAt: Date,
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    lastAccessedDay: {
      type: Number,
      default: 1
    },
    days: [{
      dayNumber: Number,
      started: Boolean,
      startedAt: Date,
      completed: Boolean,
      completedAt: Date,
      exercises: [{
        exerciseId: mongoose.Schema.Types.ObjectId,
        completed: Boolean,
        completedAt: Date
      }]
    }]
  }],
  
  // Add these fields to complete the progress tracking
  testScores: [{
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module'
    },
    score: Number,
    passedAt: Date,
    attempts: {
      type: Number,
      default: 1
    }
  }],
  totalHoursSpent: {
    type: Number,
    default: 0
  },
  notionsMastered: [String]
},
  
  // Beta Access
  betaAccess: {
    isEnabled: { type: Boolean, default: false },
    enabledAt: Date,
    enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    application: {
      email: String,
      occupation: String,
      discordId: String,
      reason: String,
      submittedAt: Date
    }
  },

  // Payment status for premium modules
  payment: {
    hasPaidAccess: { type: Boolean, default: false },
    transactions: [{
      amount: Number,
      currency: String,
      status: String,
      provider: String,
      transactionId: String,
      timestamp: Date
    }]
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

// Helper method to check if user has access to a specific module
userSchema.methods.hasAccessToModule = function(moduleId, moduleAccessLevel) {
  // Admin has access to everything
  if (this.role === 'admin') {
    return true;
  }
  
  // Check if the module is a free module
  if (moduleAccessLevel === 'free') {
    return true;
  }
  
  // Check if module requires beta access
  if (moduleAccessLevel === 'beta') {
    return this.role === 'beta' || this.role === 'admin';
  }
  
  // Check if module requires payment
  if (moduleAccessLevel === 'premium') {
    return this.payment.hasPaidAccess;
  }
  
  // Check if prerequisite modules are completed with passing scores
  if (this.progress && this.progress.testScores) {
    const testScore = this.progress.testScores.find(ts => 
      ts.moduleId.toString() === moduleId.toString());
    
    return testScore && testScore.score >= 60;
  }
  
  return false;
};

// Helper method to calculate total hours spent
userSchema.methods.calculateTotalHoursSpent = function() {
  // Each completed day counts as 1 hour (simplified model)
  let totalDays = 0;
  
  this.progress.modules.forEach(module => {
    module.days.forEach(day => {
      if (day.completed) {
        totalDays++;
      }
    });
  });
  
  this.progress.totalHoursSpent = totalDays;
  return totalDays;
};

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate total hours spent before saving
  if (this.isModified('progress.modules')) {
    this.calculateTotalHoursSpent();
  }
  
  next();
});

module.exports = mongoose.model('User', userSchema);

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProgress:
 *       type: object
 *       properties:
 *         modules:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               moduleId:
 *                 type: string
 *                 description: ID of the module
 *               started:
 *                 type: boolean
 *                 description: Whether the module has been started
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the module was started
 *               completed:
 *                 type: boolean
 *                 description: Whether the module has been completed
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the module was completed
 *               lastAccessedDay:
 *                 type: number
 *                 description: Last day accessed in the module
 *               days:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     dayNumber:
 *                       type: number
 *                     started:
 *                       type: boolean
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                     completed:
 *                       type: boolean
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                     exercises:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           exerciseId:
 *                             type: string
 *                           completed:
 *                             type: boolean
 *                           completedAt:
 *                             type: string
 *                             format: date-time
 *         testScores:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               moduleId:
 *                 type: string
 *                 description: ID of the module
 *               score:
 *                 type: number
 *                 description: Test score (0-100)
 *               passedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the test was passed
 *               attempts:
 *                 type: number
 *                 description: Number of test attempts
 *         totalHoursSpent:
 *           type: number
 *           description: Total hours spent coding
 *         notionsMastered:
 *           type: array
 *           items:
 *             type: string
 *           description: List of notions mastered
 *     UserBetaAccess:
 *       type: object
 *       properties:
 *         isEnabled:
 *           type: boolean
 *           description: Whether beta access is enabled
 *         enabledAt:
 *           type: string
 *           format: date-time
 *           description: When beta access was enabled
 *         enabledBy:
 *           type: string
 *           description: ID of admin who enabled beta access
 *         application:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *             occupation:
 *               type: string
 *             discordId:
 *               type: string
 *             reason:
 *               type: string
 *             submittedAt:
 *               type: string
 *               format: date-time
 *     UserPayment:
 *       type: object
 *       properties:
 *         hasPaidAccess:
 *           type: boolean
 *           description: Whether user has paid for premium access
 *         transactions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               status:
 *                 type: string
 *               provider:
 *                 type: string
 *               transactionId:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 */
