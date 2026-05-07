import axios from 'axios';
import cors from 'cors';
import dns from 'dns';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer } from 'http';
import path from 'path';
import { Server as SocketServer } from 'socket.io';

import { initDatabase } from '@database/mongo-database.adapter';
import { startOtpCleanupScheduler } from '@modules/auth/services/otp-cleanup.scheduler';
import { appendPaginationHeaders, parseApiQuery } from './middleware/api-query.middleware';
import { camelizeBody } from './middleware/normalize-request-body.middleware';
import logRequest from './middleware/request-logger.middleware';
import { handleError, notFound, wrapJson } from './middleware/http-response.middleware';
import routes from './routes';
import { socketService } from './modules/socket/socket.service';
import { logger } from './utils/logger';
import { setupSwagger } from './utils/swagger';

// ==================== ENV & DNS ====================
dotenv.config();
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ==================== APP CONFIG ====================
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
const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
const CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'];

// ==================== CORS ====================
function getAllowedOrigins() {
  return process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim().replace(/\/$/, '')) || [];
}

// ==================== SECURITY ====================
function setupSecurity() {
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
}

// ==================== CORE MIDDLEWARE ====================
function setupCoreMiddleware() {
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') return callback(null, true);

        return callback(null, getAllowedOrigins().includes(origin.replace(/\/$/, '')));
      },
      credentials: process.env.CORS_CREDENTIALS ? process.env.CORS_CREDENTIALS === 'true' : true,
      methods: CORS_METHODS,
      allowedHeaders: CORS_HEADERS,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(UPLOAD_DIR));
}

// ==================== API MIDDLEWARE ====================
function setupApiMiddleware() {
  app.use('/api', camelizeBody, logRequest, wrapJson, appendPaginationHeaders, parseApiQuery);
}

// ==================== RATE LIMITING ====================
function setupRateLimiting() {
  if (!AUTH_RATE_LIMIT_ENABLED) return;

  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
      max: AUTH_RATE_LIMIT_MAX,
      message: 'Too many login attempts, please try again later',
    }),
  );
}

// ==================== ROUTES ====================
function setupRoutes() {
  setupSwagger(app);
  app.use('/api', routes);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'OK',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });
}

// ==================== ERROR HANDLING ====================
function setupErrorHandling() {
  app.use(notFound);
  app.use(handleError);
}

// ==================== KEEP ALIVE ====================
async function pingService(url) {
  try {
    await axios.get(url, { timeout: 10000 });
  } catch (error) {
    const status = error.response?.status;
    if (!status) {
      logger.error(`Keep-alive request failed: ${error.message}`, 'SERVER');
    }
  }
}

function startKeepAlive() {
  const serviceUrl = process.env.PYTHON_SERVICE_URL;
  if (!serviceUrl || /localhost|127\.0\.0\.1/.test(serviceUrl)) return;

  try {
    const targetUrl = `${new URL(serviceUrl).origin}/`;
    void pingService(targetUrl);
    setInterval(() => pingService(targetUrl), KEEPALIVE_INTERVAL);
  } catch (err: any) {
    logger.error(err.message, 'SERVER');
  }
}

// ==================== SOCKET ====================
function setupSocket(httpServer: ReturnType<typeof createServer>) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ? getAllowedOrigins() : '*',
      credentials: Boolean(process.env.CORS_CREDENTIALS) || true,
    },
  });

  socketService.init(io);
}

// ==================== APP SETUP ====================
setupSecurity();
setupCoreMiddleware();
setupApiMiddleware();
setupRateLimiting();
setupRoutes();
setupErrorHandling();

// ==================== START SERVER ====================
async function bootstrap() {
  await initDatabase();
  startOtpCleanupScheduler();

  const httpServer = createServer(app);
  setupSocket(httpServer);

  httpServer.listen(PORT, () => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    logger.success(`Server is running at http://localhost:${PORT}`, 'SERVER');
    logger.info(`API Docs: ${baseUrl}/api-docs`, 'SERVER');

    startKeepAlive();
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', 'SERVER', error);
  process.exit(1);
});

export default app;
