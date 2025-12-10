
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./src/config/database');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Warning
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  SECURITY WARNING: Using default JWT secret. Set JWT_SECRET in environment variables for production.');
}

// Initialize Database
try {
  initDB();
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize database:', error);
}

// Middleware - Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://aistudiocdn.com", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://allcare.up.railway.app", "https://aistudiocdn.com", "https://esm.sh"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests from any origin for development convenience
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 login attempts per hour
  message: { error: 'Too many login attempts, please try again later.' }
});

// Apply Rate Limits
app.use('/api/auth/login', authLimiter);
app.use('/api', apiLimiter);

app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Serve Static Frontend (Production)
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Secure Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: isDev ? err.message : 'An unexpected error occurred.',
    // Only leak stack trace in development
    stack: isDev ? err.stack : undefined 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});