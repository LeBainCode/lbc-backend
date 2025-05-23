// models/ModuleTest.js
const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     TestQuestion:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         question:
 *           type: string
 *           description: The question text
 *         options:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *               isCorrect:
 *                 type: boolean
 *         type:
 *           type: string
 *           enum: [multiple-choice, true-false, coding]
 *         points:
 *           type: number
 *           description: Points awarded for correct answer
 *     ModuleTest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         moduleId:
 *           type: string
 *           description: ID of the module this test belongs to
 *         title:
 *           type: string
 *           description: Test title
 *         description:
 *           type: string
 *           description: Test description
 *         timeLimit:
 *           type: number
 *           description: Time limit in minutes
 *         passingScore:
 *           type: number
 *           description: Minimum score required to pass (percentage)
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TestQuestion'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    text: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }],
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'coding'],
    default: 'multiple-choice'
  },
  points: {
    type: Number,
    default: 1
  }
});

const moduleTestSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  timeLimit: {
    type: Number, // in minutes
    default: 30
  },
  passingScore: {
    type: Number, // percentage
    default: 60,
    min: 0,
    max: 100
  },
  questions: [questionSchema],
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
moduleTestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ModuleTest', moduleTestSchema);
