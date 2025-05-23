// models/ModuleDay.js
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Exercise:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *           description: Exercise title
 *         description:
 *           type: string
 *           description: Exercise description
 *         content:
 *           type: string
 *           description: Exercise content/instructions
 *         order:
 *           type: number
 *           description: Display order of exercise
 *     ModuleDay:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         moduleId:
 *           type: string
 *           description: ID of the parent module
 *         dayNumber:
 *           type: number
 *           description: Day number within the module
 *         title:
 *           type: string
 *           description: Day title
 *         description:
 *           type: string
 *           description: Day description
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Exercise'
 *           description: Exercises for this day
 *         notions:
 *           type: array
 *           items:
 *             type: string
 *           description: Concepts covered in this day
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
const exerciseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true
  }
});

const moduleDaySchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true
  },
  dayNumber: {
    type: Number,
    required: true,
    min: 1
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  exercises: [exerciseSchema],
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
moduleDaySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure unique combination of moduleId and dayNumber
moduleDaySchema.index({ moduleId: 1, dayNumber: 1 }, { unique: true });

// Create index on moduleId for efficient lookups
moduleDaySchema.index({ moduleId: 1 });

module.exports = mongoose.model('ModuleDay', moduleDaySchema);
