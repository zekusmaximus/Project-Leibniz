// server/routes/api/storyLinks.js
const express = require('express');
const router = express.Router();
const StoryLink = require('../../models/StoryLink');

// GET all story links
router.get('/', async (req, res) => {
  try {
    const links = await StoryLink.find();
    res.json(links);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET links by source node
router.get('/source/:sourceId', async (req, res) => {
  try {
    const links = await StoryLink.find({ source: req.params.sourceId });
    res.json(links);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET links by target node
router.get('/target/:targetId', async (req, res) => {
  try {
    const links = await StoryLink.find({ target: req.params.targetId });
    res.json(links);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST a new link
router.post('/', async (req, res) => {
  try {
    const newLink = new StoryLink(req.body);
    const link = await newLink.save();
    res.status(201).json(link);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT (update) a link
router.put('/:sourceId/:targetId', async (req, res) => {
  try {
    const link = await StoryLink.findOneAndUpdate(
      { source: req.params.sourceId, target: req.params.targetId },
      req.body,
      { new: true }
    );
    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }
    res.json(link);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE a link
router.delete('/:sourceId/:targetId', async (req, res) => {
  try {
    const link = await StoryLink.findOneAndDelete({ 
      source: req.params.sourceId, 
      target: req.params.targetId 
    });
    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }
    res.json({ message: 'Link removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;