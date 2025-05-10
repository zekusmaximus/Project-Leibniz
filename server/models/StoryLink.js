// server/models/StoryLink.js
const mongoose = require('mongoose');

const StoryLinkSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    ref: 'StoryNode'
  },
  target: {
    type: String,
    required: true,
    ref: 'StoryNode'
  },
  visualProperties: {
    color: String,
    width: Number
  },
  metadata: {
    isHidden: {
      type: Boolean,
      default: false
    },
    requiredFlags: [{
      key: String,
      value: mongoose.Schema.Types.Mixed
    }]
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

// Create a compound index to ensure uniqueness of source-target pairs
StoryLinkSchema.index({ source: 1, target: 1 }, { unique: true });

// Update the updatedAt timestamp before saving
StoryLinkSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StoryLink', StoryLinkSchema);