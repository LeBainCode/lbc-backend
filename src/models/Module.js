// models/Module.js
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Module:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Module ID
 *         name:
 *           type: string
 *           description: Module name
 *         slug:
 *           type: string
 *           description: URL-friendly module identifier
 *         description:
 *           type: string
 *           description: Module description
 *         order:
 *           type: number
 *           description: Display order of module
 *         isPaid:
 *           type: boolean
 *           description: Whether this is a premium module requiring payment
 *         prerequisiteModule:
 *           type: string
 *           description: ID of module that must be completed first
 *         prerequisiteScore:
 *           type: number
 *           description: Minimum score required on prerequisite module's test
 *         notions:
 *           type: array
 *           items:
 *             type: string
 *           description: List of concepts covered in this module
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */
const moduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  prerequisiteModule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    default: null
  },
  prerequisiteScore: {
    type: Number,
    default: 60,
    min: 0,
    max: 100
  },
  notions: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
moduleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create compound index on order field for sorting
moduleSchema.index({ order: 1 });

module.exports = mongoose.model('Module', moduleSchema);
