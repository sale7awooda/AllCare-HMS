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

// Sync default port with Vite proxy (3001). Railway/Cloud providers will still provide process.env.PORT.
const PORT = process.env.PORT || 3001; 

app.set('trust proxy', 1);

// Initialize DB
try {
  initDB();
  console.log('[Init] Database loaded and verified.');
} catch (error) {
  console.error('[Error] Critical Database Initialization Failure:', error);
}

// Global Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://esm.sh", "*"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      frameAncestors: ["'self'", "*"], 
      objectSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Permissive CORS for cross-domain frontend access (AI Studio -> Railway)
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // or any origin for this specific production/demo hybrid use case
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(morgan('dev')); 
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    database: db && db.open ? 'connected' : 'disconnected' 
  });
});

// Static Assets
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// catch-all for SPA
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
            res.status(404).send('Frontend application assets not found. Please run build script.');
        }
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Fatal] Internal Server Error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] AllCare HMS Backend running on port ${PORT}`);
});

// Graceful Shutdown
const shutdown = () => {
  console.log('[Shutdown] Terminating server process...');
  server.close(() => {
    try {
        if (db && db.open) {
            db.close();
        }
    } catch (e) {}
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);