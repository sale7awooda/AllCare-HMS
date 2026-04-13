const path = require('path');
const os = require('os');
// Load .env from project root if it exists, otherwise default (backend/.env)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { initDB, getDb } = require('./src/config/database');
const { validateEnv } = require('./src/config/env');
const { validateRbac } = require('./src/utils/validateRbac');
const { errorHandler } = require('./src/middleware/errorHandler');
const apiRoutes = require('./src/routes/api');

const app = express();

app.use(cookieParser());

// Use PORT from environment (for cloud deployments), fallback to 3001 for local dev
const PORT = process.env.PORT || 3001; 
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// --- Startup Validations ---
validateEnv();

// Initialize DB (synchronous with better-sqlite3)
try {
  initDB();
  console.log('[Init] Database loaded and verified.');
} catch (error) {
  console.error('[Error] Critical Database Initialization Failure:', error);
  process.exit(1);
}

validateRbac();

// --- Refresh Token Purge Job ---
// Cleans expired tokens immediately on start, then every 24 hours.
const purgeExpiredTokens = () => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP').run();
    if (result.changes > 0) {
      console.log(`[Purge] Removed ${result.changes} expired refresh token(s).`);
    }
  } catch (e) {
    console.error('[Purge] Failed to purge expired tokens:', e.message);
  }
};
purgeExpiredTokens();
const purgeInterval = setInterval(purgeExpiredTokens, 24 * 60 * 60 * 1000);

// --- Rate Limiting ---
// General API rate limit: 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' }
});

// Strict login rate limit: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

// Apply login limiter specifically to the login route
app.use('/api/auth/login', loginLimiter);
// Apply general limiter to all API routes
app.use('/api', apiLimiter);

// --- Security Headers (Helmet) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://esm.sh"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      frameAncestors: ["'self'"], 
      objectSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// --- CORS ---
// Configurable via ALLOWED_ORIGINS env var (comma-separated). Defaults to same-origin only.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // reflect origin if no whitelist

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(morgan(IS_PROD ? 'combined' : 'dev')); 
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  const db = getDb();
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected' 
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

// Centralized error handler (replaces raw inline handler above)
app.use(errorHandler);

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
    console.log('\x1b[32m%s\x1b[0m', ' SERVER IS READY AND RUNNING!');
    console.log(` Local Access:      http://localhost:${PORT}`);
    
    // Detect and log network addresses
    const networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach(interfaceName => {
        networkInterfaces[interfaceName].forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(` Network Access:   http://${iface.address}:${PORT}`);
            }
        });
    });
    console.log('\x1b[36m%s\x1b[0m', '=======================================================');
});

// Graceful Shutdown
const shutdown = () => {
  console.log('[Shutdown] Terminating server process...');
  clearInterval(purgeInterval);
  server.close(() => {
    try {
        const db = getDb();
        if (db) {
            db.close();
        }
    } catch (e) {}
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);