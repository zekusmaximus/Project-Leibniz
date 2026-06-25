// server/index.js
const config = require('./config');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const storyNodeRoutes = require('./routes/api/storyNodes');
const storyLinkRoutes = require('./routes/api/storyLinks');
const userProgressRoutes = require('./routes/api/userProgress');

const app = express();
const PORT = config.PORT;

// CORS: restrict to an allow-list of origins rather than reflecting any origin.
// Requests with no Origin header (curl, server-to-server, health checks) pass.
const corsOptions = {
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} is not allowed`));
  },
};
if (config.isProduction && config.allowedOrigins.length === 0) {
  console.warn(
    '[cors] No CLIENT_ORIGINS set in production — cross-origin browser requests ' +
      'will be blocked. This is expected if the API only serves the bundled client.'
  );
}

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(config.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch((err) => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/nodes', storyNodeRoutes);
app.use('/api/links', storyLinkRoutes);
app.use('/api/progress', userProgressRoutes);

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Serve static assets in production
if (config.isProduction) {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${config.NODE_ENV})`);
});
