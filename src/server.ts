import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import axios from 'axios';
import { Server as SocketIOServer } from 'socket.io';

import requestLogger from './middleware/request-logger.middleware';
import { errorHandler, notFoundHandler, wrapJsonResponse } from './middleware/http-response.middleware';
import { appendPaginationHeaders, parseApiQuery, validatePaginationQuery } from './middleware/api-query.middleware';
import { normalizeRequestBodyKeys } from './middleware/normalize-request-body.middleware';
import { setupSwagger } from './utils/swagger';
import routes from './routes';
import { initSocket } from './socket';
import { initDatabase } from '@database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const KEEPALIVE_INTERVAL = 14 * 60 * 1000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'src/database/uploads');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const AUTH_RATE_LIMIT_ENABLED = process.env.AUTH_RATE_LIMIT_ENABLED
  ? process.env.AUTH_RATE_LIMIT_ENABLED === 'true'
  : IS_PRODUCTION;
const AUTH_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000));
const AUTH_RATE_LIMIT_MAX = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_MAX || 5));

// ==================== SECURITY ====================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// ==================== CORE MIDDLEWARE ====================
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
        return callback(null, true); // true sets Access-Control-Allow-Origin to the request origin
      }

      const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''));
      const reqOrigin = origin.replace(/\/$/, '');

      if (allowedOrigins.includes(reqOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: process.env.CORS_CREDENTIALS ? process.env.CORS_CREDENTIALS === 'true' : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

// ==================== APP MIDDLEWARE ====================
app.use(normalizeRequestBodyKeys);
app.use(requestLogger);
app.use(wrapJsonResponse);
app.use(parseApiQuery);
app.use(appendPaginationHeaders);
app.use(validatePaginationQuery);

// ==================== RATE LIMITING ====================
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: 'Too many login attempts, please try again later',
});
if (AUTH_RATE_LIMIT_ENABLED) {
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// ==================== ROUTES ====================
setupSwagger(app);
app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ==================== ERROR HANDLING ====================
app.use(notFoundHandler);
app.use(errorHandler);

async function pingService(url) {
  try {
    await axios.get(url, { timeout: 10000 });
  } catch (error) {
    const status = error.response?.status;
    if (!status) {
      console.error(`Keep-alive request failed: ${error.message}`);
    }
  }
}

function startKeepAlive() {
  const serviceUrl = process.env.PYTHON_SERVICE_URL;
  if (!serviceUrl || /localhost|127\.0\.0\.1/.test(serviceUrl)) return;

  try {
    const targetUrl = `${new URL(serviceUrl).origin}/`;
    pingService(targetUrl);
    setInterval(() => pingService(targetUrl), KEEPALIVE_INTERVAL);
  } catch (err) {
    console.error(err.message);
  }
}

// ==================== START ====================
async function bootstrap() {
  await initDatabase();

  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  });

  initSocket(io);

  httpServer.listen(PORT, () => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`API Docs: ${baseUrl}/api-docs`);

    startKeepAlive();
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

export default app;
