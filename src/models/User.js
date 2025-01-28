// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
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
  }
});

module.exports = mongoose.model('User', userSchema);