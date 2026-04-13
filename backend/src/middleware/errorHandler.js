/**
 * Centralized Express error handler.
 * - In production: hides internal details, returns generic 500 messages.
 * - In development: returns full error messages for easier debugging.
 * Must be registered LAST in server.js (after all routes).
 */

const isProd = process.env.NODE_ENV === 'production';

const errorHandler = (err, req, res, next) => {
  // If headers already sent (streaming), delegate to default Express handler
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;

  // Always log internally
  if (status >= 500) {
    console.error(`[Error] ${req.method} ${req.path} →`, err);
  }

  // In production, never expose raw error messages for 5xx errors
  const message = (isProd && status >= 500)
    ? 'An internal server error occurred.'
    : (err.message || 'Unknown error');

  res.status(status).json({
    error: message,
    ...(isProd ? {} : { stack: err.stack })
  });
};

module.exports = { errorHandler };
