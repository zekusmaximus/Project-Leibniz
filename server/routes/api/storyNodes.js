// server/routes/api/storyNodes.js
const express = require('express');
const router = express.Router();
const StoryNode = require('../../models/StoryNode');

// GET all story nodes
router.get('/', async (req, res) => {
  try {
    const nodes = await StoryNode.find();
    res.json(nodes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET a specific node by ID
router.get('/:id', async (req, res) => {
  try {
    const node = await StoryNode.findOne({ id: req.params.id });
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    res.json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST a new node
router.post('/', async (req, res) => {
  try {
    const newNode = new StoryNode(req.body);
    const node = await newNode.save();
    res.status(201).json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// PUT (update) a node
router.put('/:id', async (req, res) => {
  try {
    const node = await StoryNode.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    res.json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE a node
router.delete('/:id', async (req, res) => {
  try {
    const node = await StoryNode.findOneAndDelete({ id: req.params.id });
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    res.json({ message: 'Node removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;