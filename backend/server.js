
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDB, db } = require('./src/config/database');
const apiRoutes = require('./src/routes/api');

const app = express();

// Port Selection Strategy:
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.API_PORT || (isProduction ? (process.env.PORT || 3000) : 3001);

app.set('trust proxy', 1);

// Initialize DB
try {
  initDB();
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Failed to init DB:', error);
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://esm.sh"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Permissive CORS for Dev
app.use(cors({
  origin: true, // Reflect request origin
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 10000, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: db && db.open ? 'connected' : 'disconnected' });
});

// Root Route for verification
app.get('/', (req, res) => {
  res.send('AllCare HMS Backend is Running');
});

// Serve Static Files
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend Server running on port ${PORT}`);
  console.log(`Serving static files from: ${publicPath}`);
});

// Graceful Shutdown
const shutdown = () => {
  console.log('Received kill signal, shutting down gracefully');
  server.close(() => {
    console.log('Closed remaining connections');
    try {
        if (db && db.open) {
            db.close();
            console.log('Database connection closed.');
        }
    } catch (e) {
        console.error('Error closing database:', e);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (isProduction) process.exit(1);
});
