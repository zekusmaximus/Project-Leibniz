// server/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const storyNodeRoutes = require('./routes/api/storyNodes');
const storyLinkRoutes = require('./routes/api/storyLinks');
const userProgressRoutes = require('./routes/api/userProgress');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/nodes', storyNodeRoutes);
app.use('/api/links', storyLinkRoutes);
app.use('/api/progress', userProgressRoutes);

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});