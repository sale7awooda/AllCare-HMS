const path = require('path');
// Load .env from project root if it exists, otherwise default (backend/.env)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initDB, db } = require('./src/config/database');
const apiRoutes = require('./src/routes/api');

const app = express();

// Port Selection Strategy:
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 8080; // Railway and Render prefer 'PORT'

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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Added data: and specific CDNs for flexibility
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://esm.sh", "*"], // Allow all connections for dev/proxy flexibility
      imgSrc: ["'self'", "data:", "https:", "http:"],
      frameAncestors: ["'self'", "*"], // Allow being iframed in Google AI Studio
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null, // Allow HTTP mixed content if necessary during transitions
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Permissive CORS for Railway and AI Studio
app.use(cors({
    origin: '*', // Allow all for maximum compatibility in this demo environment
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(morgan('dev'));
app.use(express.json());

// Rate Limiting - Relaxed for Hospital System
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 10000, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Debug Middleware to log API hits
app.use('/api', (req, res, next) => {
  console.log(`[API Hit] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: db && db.open ? 'connected' : 'disconnected' });
});

// Serve Static Files
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            if (!res.headersSent) {
                res.status(404).json({ error: 'Frontend not found', details: 'Ensure build assets are copied to backend/public' });
            }
        }
    });
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
});
