
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initDB } = require('./src/config/database');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

console.log('Starting AllCare HMS Backend...');

// Initialize Database
try {
  initDB();
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, 
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', 
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Health Check (For Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiRoutes);

// --- SERVE FRONTEND (Production) ---
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running and listening on port ${PORT}`);
});
