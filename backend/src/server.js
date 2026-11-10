import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import catalogRoutes from './routes/catalogRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import paypalRoutes from './routes/paypalRoutes.js';
import configRoutes from './routes/configRoutes.js';
import { getHealthHandler } from './controllers/configController.js';
import { initializeLedger } from './services/ledgerService.js';
import { isPayPalConfigured } from './services/paypalService.js';
import { isGeminiConfigured, getGeminiModel } from './services/geminiService.js';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in allowed list
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request parsing with size limitation
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', generalLimiter);

// Specific Rate Limiter for AI and Payment Endpoints
const sensitiveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, message: 'Rate limit reached for sensitive operation. Please wait a minute.' }
});
app.use(['/api/agent/', '/api/paypal/'], sensitiveLimiter);

// Health Check
app.get('/api/health', getHealthHandler);

// API Route Modules
app.use('/api/catalog', catalogRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/config', configRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Never leak sensitive internals or secrets
  const safeMessage = err.message || 'An unexpected internal server error occurred.';
  console.error(`[Error] ${req.method} ${req.originalUrl} - Status ${statusCode}:`, safeMessage);

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    error: isProduction ? undefined : err.name
  });
});

// Start Server & Initialize Services
async function startServer() {
  await initializeLedger();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  PAYFLOW AI SERVER RUNNING ON PORT ${PORT}`);
    console.log(`  Node Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Frontend Origin:  ${FRONTEND_URL}`);
    console.log(`  PayPal Sandbox:   ${isPayPalConfigured() ? 'CONFIGURED (Live Sandbox)' : 'SIMULATION MODE (Demo Keys)'}`);
    console.log(`  Gemini AI:        ${isGeminiConfigured() ? `CONFIGURED (${getGeminiModel()})` : 'DETERMINISTIC FALLBACK ACTIVE'}`);
    console.log(`=======================================================`);
  });
}

// Only start when run directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Fatal Server Startup Error:', err);
    process.exit(1);
  });
}

export default app;
