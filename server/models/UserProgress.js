// server/models/UserProgress.js
const mongoose = require('mongoose');

const UserProgressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  storyState: {
    currentNodeId: {
      type: String,
      required: true
    },
    visitCounts: {
      type: Map,
      of: Number,
      default: new Map()
    },
    flags: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    },
    history: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index to ensure uniqueness of userId
UserProgressSchema.index({ userId: 1 }, { unique: true });

// Update the updatedAt timestamp before saving
UserProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('UserProgress', UserProgressSchema);