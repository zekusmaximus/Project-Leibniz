// server/models/StoryNode.js
const mongoose = require('mongoose');

const StoryNodeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    required: true
  },
  choices: [{
    targetId: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    condition: {
      type: String, // Stored as a string that will be evaluated
      required: false
    }
  }],
  textVariants: [{
    id: { type: String, required: true },
    text: { type: String, required: true },
    priority: { type: Number, default: 0 },
    condition: { type: String, required: true }
  }],
  // Compositional "morphing" prose (the beats model). Optional and additive: a
  // node with `prose` renders it instead of `text` + `textVariants`. Conditions
  // are stored as serialized ConditionSpec strings, exactly like textVariants.
  prose: [{
    id: { type: String, required: true },
    includeWhen: { type: String, required: false },
    phrasings: [{
      id: { type: String, required: false },
      text: { type: String, required: true },
      priority: { type: Number, default: 0 },
      when: { type: String, required: false }
    }]
  }],
  visualProperties: {
    x: Number,
    y: Number,
    color: String,
    size: Number
  },
  metadata: {
    isStartNode: {
      type: Boolean,
      default: false
    },
    tags: [String],
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

// Update the updatedAt timestamp before saving
StoryNodeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StoryNode', StoryNodeSchema);