// server/routes/api/userProgress.js
const express = require('express');
const router = express.Router();
const UserProgress = require('../../models/UserProgress');
const { v4: uuidv4 } = require('uuid');

// GET user progress by user ID
router.get('/:userId', async (req, res) => {
  try {
    const progress = await UserProgress.findOne({ userId: req.params.userId });
    if (!progress) {
      return res.status(404).json({ message: 'Progress not found' });
    }
    res.json(progress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST or update user progress
router.post('/', async (req, res) => {
  try {
    let { userId, storyState } = req.body;
    
    // Generate anonymous user ID if not provided
    if (!userId) {
      userId = uuidv4();
    }
    
    // Try to find existing progress for this user
    let progress = await UserProgress.findOne({ userId });
    
    if (progress) {
      // Update existing progress
      progress.storyState = storyState;
      progress = await progress.save();
    } else {
      // Create new progress
      progress = new UserProgress({
        userId,
        storyState
      });
      progress = await progress.save();
    }
    
    res.status(201).json({ userId, progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE user progress
router.delete('/:userId', async (req, res) => {
  try {
    const progress = await UserProgress.findOneAndDelete({ userId: req.params.userId });
    if (!progress) {
      return res.status(404).json({ message: 'Progress not found' });
    }
    res.json({ message: 'Progress deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;