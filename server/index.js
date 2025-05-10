require('dotenv').config(); // For environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // If you installed cors

const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable or default

// Middleware
app.use(cors()); // Enable CORS for all routes (adjust as needed for production)
app.use(express.json()); // To parse JSON request bodies

// MongoDB Connection (replace with your Atlas connection string)
// You'll put your MONGODB_URI in a .env file
mongoose.connect(process.env.MONGODB_URI, {
    // useNewUrlParser: true, // These options are generally default now
    // useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully!'))
.catch(err => console.error('MongoDB connection error:', err));

// Basic Route (Test)
app.get('/api/test', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});