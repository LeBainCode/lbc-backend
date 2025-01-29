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
    required: function() {
      return this.role === 'admin'; // Only required for admin users
    }
  },
  githubId: {
    type: String,
    sparse: true, // Allows null values but ensures uniqueness when present
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
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