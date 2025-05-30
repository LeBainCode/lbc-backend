// models/User.js - Complete User model with Application ID and Swagger documentation
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the user
 *           example: "60d21b4967d0d8992e610c85"
 *         username:
 *           type: string
 *           description: User's unique username
 *           example: "001"
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address (optional for OAuth users)
 *           example: "user@example.com"
 *         role:
 *           type: string
 *           enum: [user, beta, admin]
 *           description: User's role and access level
 *           example: "user"
 *         githubProfile:
 *           $ref: '#/components/schemas/GitHubProfile'
 *         progress:
 *           $ref: '#/components/schemas/UserProgress'
 *         betaAccess:
 *           $ref: '#/components/schemas/UserBetaAccess'
 *         payment:
 *           $ref: '#/components/schemas/UserPayment'
 *         security:
 *           $ref: '#/components/schemas/UserSecurity'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: User registration timestamp
 *           example: "2025-05-01T12:00:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2025-05-30T15:30:00Z"
 *     
 *     GitHubProfile:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: GitHub username
 *           example: "johndoe"
 *         profileUrl:
 *           type: string
 *           format: uri
 *           description: GitHub profile URL
 *           example: "https://github.com/johndoe"
 *         avatarUrl:
 *           type: string
 *           format: uri
 *           description: GitHub avatar image URL
 *           example: "https://avatars.githubusercontent.com/u/123456?v=4"
 *     
 *     UserProgress:
 *       type: object
 *       properties:
 *         cModule:
 *           type: object
 *           description: Legacy C module progress (deprecated)
 *           properties:
 *             completed:
 *               type: number
 *               example: 0
 *             total:
 *               type: number
 *               example: 10
 *         examModule:
 *           type: object
 *           description: Legacy exam module progress (deprecated)
 *           properties:
 *             completed:
 *               type: number
 *               example: 0
 *             total:
 *               type: number
 *               example: 4
 *             isUnlocked:
 *               type: boolean
 *               example: false
 *         modules:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ModuleProgress'
 *           description: New module-based progress tracking
 *         testScores:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TestScore'
 *           description: Test scores for completed modules
 *         totalHoursSpent:
 *           type: number
 *           description: Total hours spent learning (auto-calculated)
 *           example: 12
 *         notionsMastered:
 *           type: array
 *           items:
 *             type: string
 *           description: List of programming concepts mastered
 *           example: ["git", "variables", "functions"]
 *     
 *     ModuleProgress:
 *       type: object
 *       properties:
 *         moduleId:
 *           type: string
 *           description: ID of the module
 *           example: "60d21b4967d0d8992e610c85"
 *         started:
 *           type: boolean
 *           description: Whether the module has been started
 *           example: true
 *         startedAt:
 *           type: string
 *           format: date-time
 *           description: When the module was started
 *           example: "2025-05-01T10:00:00Z"
 *         completed:
 *           type: boolean
 *           description: Whether the module has been completed
 *           example: false
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the module was completed
 *           example: null
 *         lastAccessedDay:
 *           type: number
 *           description: Last day accessed in the module
 *           example: 3
 *         days:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DayProgress'
 *           description: Progress for each day in the module
 *     
 *     DayProgress:
 *       type: object
 *       properties:
 *         dayNumber:
 *           type: number
 *           description: Day number within the module
 *           example: 1
 *         started:
 *           type: boolean
 *           description: Whether the day has been started
 *           example: true
 *         startedAt:
 *           type: string
 *           format: date-time
 *           description: When the day was started
 *           example: "2025-05-01T10:00:00Z"
 *         completed:
 *           type: boolean
 *           description: Whether the day has been completed
 *           example: true
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the day was completed
 *           example: "2025-05-01T16:30:00Z"
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExerciseProgress'
 *           description: Progress for exercises in this day
 *     
 *     ExerciseProgress:
 *       type: object
 *       properties:
 *         exerciseId:
 *           type: string
 *           description: ID of the exercise
 *           example: "60d21b4967d0d8992e610c86"
 *         completed:
 *           type: boolean
 *           description: Whether the exercise has been completed
 *           example: true
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the exercise was completed
 *           example: "2025-05-01T14:15:00Z"
 *     
 *     TestScore:
 *       type: object
 *       properties:
 *         moduleId:
 *           type: string
 *           description: ID of the module the test belongs to
 *           example: "60d21b4967d0d8992e610c85"
 *         score:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: Test score as a percentage
 *           example: 85
 *         passedAt:
 *           type: string
 *           format: date-time
 *           description: When the test was passed
 *           example: "2025-05-01T18:00:00Z"
 *         attempts:
 *           type: number
 *           minimum: 1
 *           description: Number of test attempts
 *           example: 2
 *     
 *     UserBetaAccess:
 *       type: object
 *       properties:
 *         isEnabled:
 *           type: boolean
 *           description: Whether beta access is currently enabled
 *           example: false
 *         enabledAt:
 *           type: string
 *           format: date-time
 *           description: When beta access was enabled
 *           example: null
 *         enabledBy:
 *           type: string
 *           description: ID of admin who enabled beta access
 *           example: null
 *         revokedAt:
 *           type: string
 *           format: date-time
 *           description: When beta access was revoked
 *           example: null
 *         revokedBy:
 *           type: string
 *           description: ID of admin who revoked beta access
 *           example: null
 *         application:
 *           $ref: '#/components/schemas/BetaApplication'
 *     
 *     BetaApplication:
 *       type: object
 *       properties:
 *         applicationId:
 *           type: string
 *           description: Unique application ID for tracking
 *           example: "65f8a1b23c4d5e6f78901234"
 *         email:
 *           type: string
 *           format: email
 *           description: Email address used in application
 *           example: "user@example.com"
 *         occupation:
 *           type: string
 *           description: Applicant's occupation
 *           example: "Software Developer"
 *         discordId:
 *           type: string
 *           description: Discord username/ID (optional)
 *           example: "user#1234"
 *         reason:
 *           type: string
 *           description: Reason for requesting beta access
 *           example: "I want to help test new features and provide feedback"
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           description: When the application was submitted
 *           example: "2025-05-01T12:00:00Z"
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: Current status of the application
 *           example: "pending"
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           description: When the application was reviewed
 *           example: null
 *         reviewedBy:
 *           type: string
 *           description: ID of admin who reviewed the application
 *           example: null
 *         rejectionReason:
 *           type: string
 *           description: Reason for rejection (if rejected)
 *           example: null
 *         adminComment:
 *           type: string
 *           description: Admin comment on the application
 *           example: null
 *     
 *     UserPayment:
 *       type: object
 *       properties:
 *         hasPaidAccess:
 *           type: boolean
 *           description: Whether user has paid for premium access
 *           example: false
 *         transactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaymentTransaction'
 *           description: Payment transaction history
 *     
 *     PaymentTransaction:
 *       type: object
 *       properties:
 *         amount:
 *           type: number
 *           description: Transaction amount
 *           example: 29.99
 *         currency:
 *           type: string
 *           description: Currency code
 *           example: "USD"
 *         status:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *           description: Transaction status
 *           example: "completed"
 *         provider:
 *           type: string
 *           description: Payment provider
 *           example: "stripe"
 *         transactionId:
 *           type: string
 *           description: External transaction ID
 *           example: "txn_1234567890"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Transaction timestamp
 *           example: "2025-05-01T10:30:00Z"
 *     
 *     UserSecurity:
 *       type: object
 *       properties:
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *           example: "2025-05-30T09:15:00Z"
 *         loginHistory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LoginRecord'
 *           description: Recent login history (last 5 logins)
 *         passwordLastChanged:
 *           type: string
 *           format: date-time
 *           description: When password was last changed (admin only)
 *           example: null
 *         tokenVersion:
 *           type: number
 *           description: JWT token version for invalidating sessions
 *           example: 1
 *         tokenVersionUpdatedAt:
 *           type: string
 *           format: date-time
 *           description: When token version was last updated
 *           example: null
 *     
 *     LoginRecord:
 *       type: object
 *       properties:
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Login timestamp
 *           example: "2025-05-30T09:15:00Z"
 *         ip:
 *           type: string
 *           description: IP address of login
 *           example: "192.168.1.100"
 *         userAgent:
 *           type: string
 *           description: Browser/client user agent
 *           example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *         provider:
 *           type: string
 *           enum: [github, organizational]
 *           description: Authentication provider used
 *           example: "github"
 *         location:
 *           type: string
 *           description: Geographic location (if available)
 *           example: "New York, NY"
 *     
 *     UserProfile:
 *       type: object
 *       description: Public user profile information
 *       properties:
 *         id:
 *           type: string
 *           example: "60d21b4967d0d8992e610c85"
 *         username:
 *           type: string
 *           example: "001"
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         role:
 *           type: string
 *           enum: [user, beta, admin]
 *           example: "user"
 *         githubProfile:
 *           $ref: '#/components/schemas/GitHubProfile'
 *         progress:
 *           type: object
 *           properties:
 *             totalHoursSpent:
 *               type: number
 *               example: 12
 *             notionsMastered:
 *               type: number
 *               example: 15
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2025-05-01T12:00:00Z"
 *     
 *     UserStats:
 *       type: object
 *       description: User statistics and achievements
 *       properties:
 *         totalHoursSpent:
 *           type: number
 *           description: Total learning hours
 *           example: 24
 *         modulesCompleted:
 *           type: number
 *           description: Number of modules completed
 *           example: 2
 *         exercisesCompleted:
 *           type: number
 *           description: Number of exercises completed
 *           example: 45
 *         testsPasssed:
 *           type: number
 *           description: Number of tests passed
 *           example: 2
 *         averageTestScore:
 *           type: number
 *           description: Average test score across all modules
 *           example: 82.5
 *         currentStreak:
 *           type: number
 *           description: Current daily learning streak
 *           example: 7
 *         longestStreak:
 *           type: number
 *           description: Longest daily learning streak
 *           example: 15
 *         notionsMastered:
 *           type: array
 *           items:
 *             type: string
 *           description: Programming concepts mastered
 *           example: ["git", "variables", "functions", "loops"]
 */

const userSchema = new mongoose.Schema({
  // ===========================================
  // BASIC INFORMATION
  // ===========================================
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: [1, 'Username is required'],
    maxlength: [50, 'Username cannot exceed 50 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  
  email: {
    type: String,
    sparse: true, // Allows multiple null values but unique non-null values
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
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  
  // ===========================================
  // AUTHENTICATION & OAUTH
  // ===========================================
  githubId: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // ===========================================
  // ROLE & ACCESS CONTROL
  // ===========================================
  role: {
    type: String,
    enum: {
      values: ['user', 'beta', 'admin'],
      message: 'Role must be one of: user, beta, admin'
    },
    default: 'user'
  },
  
  // ===========================================
  // GITHUB PROFILE DATA
  // ===========================================
  githubProfile: {
    username: {
      type: String,
      trim: true
    },
    profileUrl: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Profile URL must be a valid HTTP/HTTPS URL'
      }
    },
    avatarUrl: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Avatar URL must be a valid HTTP/HTTPS URL'
      }
    }
  },
  
  // ===========================================
  // PROGRESS TRACKING
  // ===========================================
  progress: {
    // Legacy fields for backward compatibility
    cModule: {
      completed: { 
        type: Number, 
        default: 0,
        min: [0, 'Completed count cannot be negative']
      },
      total: { 
        type: Number, 
        default: 10,
        min: [1, 'Total must be at least 1']
      }
    },
    
    examModule: {
      completed: { 
        type: Number, 
        default: 0,
        min: [0, 'Completed count cannot be negative']
      },
      total: { 
        type: Number, 
        default: 4,
        min: [1, 'Total must be at least 1']
      },
      isUnlocked: { 
        type: Boolean, 
        default: false 
      }
    },
    
    // New module-based progress tracking
    modules: [{
      moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true
      },
      started: {
        type: Boolean,
        default: false
      },
      startedAt: {
        type: Date,
        validate: {
          validator: function(v) {
            return !v || v <= new Date();
          },
          message: 'Start date cannot be in the future'
        }
      },
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date,
        validate: {
          validator: function(v) {
            return !v || v <= new Date();
          },
          message: 'Completion date cannot be in the future'
        }
      },
      lastAccessedDay: {
        type: Number,
        default: 1,
        min: [1, 'Day number must be at least 1']
      },
      days: [{
        dayNumber: {
          type: Number,
          required: true,
          min: [1, 'Day number must be at least 1']
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
        exercises: [{
          exerciseId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
          },
          completed: {
            type: Boolean,
            default: false
          },
          completedAt: Date
        }]
      }]
    }],
    
    // Test scores tracking
    testScores: [{
      moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true
      },
      score: {
        type: Number,
        required: true,
        min: [0, 'Score cannot be negative'],
        max: [100, 'Score cannot exceed 100']
      },
      passedAt: {
        type: Date,
        required: true,
        validate: {
          validator: function(v) {
            return v <= new Date();
          },
          message: 'Pass date cannot be in the future'
        }
      },
      attempts: {
        type: Number,
        default: 1,
        min: [1, 'Attempts must be at least 1']
      }
    }],
    
    // Calculated fields
    totalHoursSpent: {
      type: Number,
      default: 0,
      min: [0, 'Hours cannot be negative']
    },
    
    notionsMastered: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  },
  
  // ===========================================
  // BETA ACCESS MANAGEMENT
  // ===========================================
  betaAccess: {
    isEnabled: { 
      type: Boolean, 
      default: false 
    },
    enabledAt: Date,
    enabledBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    revokedAt: Date,
    revokedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    
    application: {
      applicationId: {
        type: String,
        unique: true,
        sparse: true, // Allows null values but ensures uniqueness when not null
        index: true,  // Add index for faster lookups
        validate: {
          validator: function(v) {
            return !v || /^[a-f\d]{24}$/i.test(v); // Valid MongoDB ObjectId format
          },
          message: 'Application ID must be a valid ObjectId format'
        }
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
          validator: function(v) {
            return !v || /^\S+@\S+\.\S+$/.test(v);
          },
          message: 'Invalid email format in beta application'
        }
      },
      occupation: {
        type: String,
        trim: true,
        maxlength: [100, 'Occupation cannot exceed 100 characters']
      },
      discordId: {
        type: String,
        trim: true,
        maxlength: [50, 'Discord ID cannot exceed 50 characters']
      },
      reason: {
        type: String,
        trim: true,
        maxlength: [1000, 'Reason cannot exceed 1000 characters']
      },
      submittedAt: Date,
      status: {
        type: String,
        enum: {
          values: ['pending', 'approved', 'rejected'],
          message: 'Status must be one of: pending, approved, rejected'
        },
        default: 'pending'
      },
      reviewedAt: Date,
      reviewedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
      },
      rejectionReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Rejection reason cannot exceed 500 characters']
      },
      adminComment: {
        type: String,
        trim: true,
        maxlength: [500, 'Admin comment cannot exceed 500 characters']
      }
    }
  },

  // ===========================================
  // PAYMENT & PREMIUM ACCESS
  // ===========================================
  payment: {
    hasPaidAccess: { 
      type: Boolean, 
      default: false 
    },
    transactions: [{
      amount: {
        type: Number,
        required: true,
        min: [0, 'Amount cannot be negative']
      },
      currency: {
        type: String,
        required: true,
        uppercase: true,
        minlength: [3, 'Currency code must be 3 characters'],
        maxlength: [3, 'Currency code must be 3 characters']
      },
      status: {
        type: String,
        required: true,
        enum: {
          values: ['pending', 'completed', 'failed', 'refunded'],
          message: 'Transaction status must be one of: pending, completed, failed, refunded'
        }
      },
      provider: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
      },
      transactionId: {
        type: String,
        required: true,
        trim: true
      },
      timestamp: {
        type: Date,
        required: true,
        default: Date.now
      }
    }]
  },
  
  // ===========================================
  // SECURITY & SESSION MANAGEMENT
  // ===========================================
  security: {
    lastLogin: Date,
    passwordLastChanged: Date,
    tokenVersion: {
      type: Number,
      default: 1,
      min: [1, 'Token version must be at least 1']
    },
    tokenVersionUpdatedAt: Date,
    
    loginHistory: [{
      timestamp: {
        type: Date,
        required: true,
        default: Date.now
      },
      ip: {
        type: String,
        trim: true
      },
      userAgent: {
        type: String,
        trim: true
      },
      provider: {
        type: String,
        enum: ['github', 'organizational'],
        default: 'github'
      },
      location: {
        type: String,
        trim: true
      }
    }]
  },
  
  // ===========================================
  // TIMESTAMPS
  // ===========================================
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true // Prevent modification after creation
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  // Schema options
  timestamps: false, // We handle timestamps manually
  versionKey: false, // Disable __v field
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.password;
      delete ret.githubId;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ===========================================
// INDEXES FOR PERFORMANCE
// ===========================================
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ githubId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'betaAccess.application.applicationId': 1 }); // Index for application ID lookups
userSchema.index({ 'betaAccess.application.submittedAt': 1 });
userSchema.index({ 'betaAccess.application.status': 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ 'security.lastLogin': 1 });

// Compound indexes
userSchema.index({ role: 1, 'betaAccess.isEnabled': 1 });
userSchema.index({ 'progress.modules.moduleId': 1, username: 1 });
userSchema.index({ 'betaAccess.application.status': 1, 'betaAccess.application.submittedAt': -1 }); // For filtering and sorting applications

// ===========================================
// VIRTUAL FIELDS
// ===========================================
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

userSchema.virtual('isActive').get(function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Add null checks - this prevents the error
  return this.security && this.security.lastLogin && this.security.lastLogin > thirtyDaysAgo;
});

userSchema.virtual('completionRate').get(function() {
  // Add comprehensive null checks - THIS IS THE LINE CAUSING THE ERROR
  if (!this.progress || !this.progress.modules || !Array.isArray(this.progress.modules) || this.progress.modules.length === 0) {
    return 0;
  }
  
  try {
    const completedModules = this.progress.modules.filter(m => m && m.completed).length;
    return Math.round((completedModules / this.progress.modules.length) * 100);
  } catch (error) {
    console.error('Error calculating completion rate:', error);
    return 0;
  }
});

// ===========================================
// INSTANCE METHODS
// ===========================================

// Check if user has access to a specific module
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

// Calculate total hours spent learning
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

// Get beta application status
userSchema.methods.getBetaApplicationStatus = function() {
  if (this.role === 'beta' || this.betaAccess.isEnabled) {
    return 'approved';
  }
  
  if (this.betaAccess.application && this.betaAccess.application.submittedAt) {
    return this.betaAccess.application.status || 'pending';
  }
  
  return 'not_applied';
};

// Add progress for a module
userSchema.methods.addModuleProgress = function(moduleId) {
  const existingProgress = this.progress.modules.find(
    m => m.moduleId.toString() === moduleId.toString()
  );
  
  if (!existingProgress) {
    this.progress.modules.push({
      moduleId,
      started: true,
      startedAt: new Date(),
      completed: false,
      lastAccessedDay: 1,
      days: []
    });
  }
  
  return this.save();
};

// Complete a day in a module
userSchema.methods.completeDayInModule = function(moduleId, dayNumber) {
  const moduleProgress = this.progress.modules.find(
    m => m.moduleId.toString() === moduleId.toString()
  );
  
  if (!moduleProgress) {
    throw new Error('Module progress not found');
  }
  
  let dayProgress = moduleProgress.days.find(d => d.dayNumber === dayNumber);
  
  if (!dayProgress) {
    dayProgress = {
      dayNumber,
      started: true,
      startedAt: new Date(),
      completed: true,
      completedAt: new Date(),
      exercises: []
    };
    moduleProgress.days.push(dayProgress);
  } else {
    dayProgress.completed = true;
    dayProgress.completedAt = new Date();
  }
  
  moduleProgress.lastAccessedDay = Math.max(moduleProgress.lastAccessedDay, dayNumber);
  
  return this.save();
};

// Add test score
userSchema.methods.addTestScore = function(moduleId, score, attempts = 1) {
  const existingScore = this.progress.testScores.find(
    ts => ts.moduleId.toString() === moduleId.toString()
  );
  
  if (existingScore) {
    existingScore.score = Math.max(existingScore.score, score);
    existingScore.attempts += attempts;
    if (score >= 60) {
      existingScore.passedAt = new Date();
    }
  } else {
    this.progress.testScores.push({
      moduleId,
      score,
      passedAt: score >= 60 ? new Date() : null,
      attempts
    });
  }
  
  return this.save();
};

// Create beta application
userSchema.methods.createBetaApplication = function(applicationData) {
  if (this.betaAccess.application && this.betaAccess.application.submittedAt) {
    throw new Error('User already has a beta application');
  }
  
  const applicationId = new mongoose.Types.ObjectId().toString();
  
  this.betaAccess.application = {
    applicationId,
    email: applicationData.email,
    occupation: applicationData.occupation,
    discordId: applicationData.discordId || '',
    reason: applicationData.reason || '',
    submittedAt: new Date(),
    status: 'pending'
  };
  
  return applicationId;
};

// Check if user has beta application
userSchema.methods.hasBetaApplication = function() {
  return !!(this.betaAccess.application && this.betaAccess.application.submittedAt);
};

// Get application ID if exists
userSchema.methods.getApplicationId = function() {
  return this.betaAccess.application?.applicationId || null;
};

// Check password (for admin users)
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('No password set for this user');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// ===========================================
// STATIC METHODS
// ===========================================

// Find users by role
userSchema.statics.findByRole = function(role) {
  return this.find({ role });
};

// Find users with beta applications
userSchema.statics.findBetaApplications = function(status = 'all') {
  const query = {
    'betaAccess.application.submittedAt': { $exists: true }
  };
  
  if (status !== 'all') {
    query['betaAccess.application.status'] = status;
  }
  
  return this.find(query)
    .select('username email role betaAccess createdAt')
    .sort({ 'betaAccess.application.submittedAt': -1 });
};

// Find user by application ID
userSchema.statics.findByApplicationId = function(applicationId) {
  return this.findOne({
    'betaAccess.application.applicationId': applicationId
  }).select('username email role betaAccess createdAt');
};

// Generate unique application ID
userSchema.statics.generateApplicationId = function() {
  return new mongoose.Types.ObjectId().toString();
};

// Get application statistics
userSchema.statics.getApplicationStatistics = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        'betaAccess.application.submittedAt': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$betaAccess.application.status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    totalApplications: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0
  };
  
  stats.forEach(stat => {
    result.totalApplications += stat.count;
    if (stat._id === 'pending') result.pendingCount = stat.count;
    if (stat._id === 'approved') result.approvedCount = stat.count;
    if (stat._id === 'rejected') result.rejectedCount = stat.count;
  });
  
  return result;
};

// Get user statistics
userSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        regularUsers: {
          $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] }
        },
        betaUsers: {
          $sum: { $cond: [{ $eq: ['$role', 'beta'] }, 1, 0] }
        },
        adminUsers: {
          $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
        },
        usersWithEmail: {
          $sum: { $cond: [{ $ne: ['$email', null] }, 1, 0] }
        },
        githubUsers: {
          $sum: { $cond: [{ $ne: ['$githubId', null] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    regularUsers: 0,
    betaUsers: 0,
    adminUsers: 0,
    usersWithEmail: 0,
    githubUsers: 0
  };
};

// ===========================================
// MIDDLEWARE (HOOKS)
// ===========================================

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Update timestamp
  this.updatedAt = new Date();
  
  // Hash password if it's modified (for admin users)
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  // Generate application ID if application is being created without one
  if (this.betaAccess.application && 
      this.betaAccess.application.submittedAt && 
      !this.betaAccess.application.applicationId) {
    this.betaAccess.application.applicationId = new mongoose.Types.ObjectId().toString();
  }
  
  // Calculate total hours spent if modules are modified
  if (this.isModified('progress.modules')) {
    this.calculateTotalHoursSpent();
  }
  
  // Validate beta application status consistency
  if (this.betaAccess.application && this.betaAccess.application.status === 'approved') {
    if (this.role !== 'beta' && !this.betaAccess.isEnabled) {
      this.role = 'beta';
      this.betaAccess.isEnabled = true;
      this.betaAccess.enabledAt = this.betaAccess.enabledAt || new Date();
    }
  }
  
  // Limit login history to last 10 entries
  if (this.security && this.security.loginHistory && this.security.loginHistory.length > 10) {
    this.security.loginHistory = this.security.loginHistory.slice(-10);
  }
  
  next();
});

// Post-save middleware for logging
userSchema.post('save', function(doc) {
  console.log(`User ${doc.username} (${doc._id}) saved successfully`);
});

// Pre-remove middleware
userSchema.pre('remove', function(next) {
  console.log(`Removing user: ${this.username}`);
  next();
});

// ===========================================
// ERROR HANDLING
// ===========================================
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

// ===========================================
// EXPORT MODEL
// ===========================================
module.exports = mongoose.model('User', userSchema);