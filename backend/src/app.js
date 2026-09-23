import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import { apiRateLimiter, authRateLimiter } from './middleware/rateLimiter.js';

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration - Restrict to configured origins
const configuredOrigins = config.clientUrl
  ? config.clientUrl.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : [];

const allowedOrigins = [
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/+$/, '');

    // Allow configured origins, localhost, dev mode, or any Vercel domain (*.vercel.app)
    const isAllowed =
      allowedOrigins.includes(cleanOrigin) ||
      config.nodeEnv === 'development' ||
      cleanOrigin.endsWith('.vercel.app') ||
      /\.vercel\.app$/.test(new URL(origin).hostname);

    if (isAllowed) {
      return callback(null, true);
    }

    // Safely reject disallowed origins without throwing an Error (which would cause a 500 status)
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'x-ats-key',
    'idempotency-key',
    'Idempotency-Key',
    'x-idempotency-key',
    'X-Idempotency-Key',
    'x-request-id',
    'X-Request-Id',
  ],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// SECURITY: Static /uploads route is REMOVED to protect HR documents.
// All documents must be retrieved via authenticated endpoint GET /api/v1/documents/:id/download.

// Request Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/api/v1/auth/login', authRateLimiter);
app.use('/api', apiRateLimiter);

// Mount API Routes
app.use('/api', apiRouter);

// Root Health / Info endpoint for deployment verification
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'HRMS Portal API Server Running',
    version: '1.0.0',
    health: '/api/v1/health',
    environment: config.nodeEnv,
    diagnostics: {
      dbConfigured: Boolean(config.db.databaseUrl),
      jwtConfigured: Boolean(process.env.JWT_SECRET),
      clientUrl: config.clientUrl || '(default)',
    },
  });
});

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
