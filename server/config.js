// server/config.js
//
// Centralised, validated runtime configuration. Importing this module loads
// server/.env and FAILS FAST with a clear message if a required variable is
// missing, instead of letting the app crash deep inside mongoose later (or, for
// CORS, silently reflecting every origin).
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(
      `\n[config] Missing required environment variable: ${name}\n` +
        'Copy server/.env.example to server/.env and fill in real values.\n'
    );
    process.exit(1);
  }
  return value.trim();
}

// CORS allow-list. In development we default to the Vite dev/preview origins; in
// production you MUST set CLIENT_ORIGINS (comma-separated) — unless the API only
// serves the bundled, same-origin client, in which case no origins are needed.
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];
const allowedOrigins = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : isProduction
    ? []
    : DEV_ORIGINS;

module.exports = {
  NODE_ENV,
  isProduction,
  PORT: process.env.PORT || 3001,
  MONGODB_URI: requireEnv('MONGODB_URI'),
  allowedOrigins,
};
