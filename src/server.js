import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import axios from 'axios';

import loggerMiddleware from './middleware/logger.middleware';
import { responseInterceptor, errorHandler, notFoundHandler } from './middleware/response.middleware';
import { parseQuery, formatResponse, validateQuery, logQuery } from './middleware/query.middleware';
import { setupSwagger } from './utils/swagger';
import routes from './routes';
import { initDatabase } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const KEEPALIVE_INTERVAL = 14 * 60 * 1000;

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
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'database/uploads')));

// ==================== APP MIDDLEWARE ====================
app.use(loggerMiddleware);
app.use(responseInterceptor);
app.use(parseQuery);
app.use(formatResponse);
app.use(validateQuery);
app.use(logQuery);

// ==================== RATE LIMITING ====================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

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

// ==================== HELPERS ====================
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

async function pingService(url) {
  try {
    await axios.get(url, { timeout: 10000 });
    console.log(`[${new Date().toISOString()}] 💓 Wake up successful`);
  } catch (error) {
    const status = error.response?.status;
    if (status) {
      console.log(`[${new Date().toISOString()}] 💓 Wake up successful (Status: ${status})`);
    } else {
      console.error(`[${new Date().toISOString()}] ⚠️ Wake up failed: ${error.message}`);
    }
  }
}

function startKeepAlive() {
  const serviceUrl = process.env.PYTHON_SERVICE_URL;
  if (!serviceUrl || /localhost|127\.0\.0\.1/.test(serviceUrl)) return;

  try {
    const targetUrl = `${new URL(serviceUrl).origin}/`;
    console.log(`⏰ Keep-alive: ${targetUrl}`);
    pingService(targetUrl);
    setInterval(() => pingService(targetUrl), KEEPALIVE_INTERVAL);
  } catch (err) {
    console.error(err.message);
  }
}

// ==================== START ====================
async function bootstrap() {
  await initDatabase();

  app.listen(PORT, () => {
    const ip = getNetworkIp();
    console.log(`
╔══════════════════════════════════════════╗
║  🚀 Server Started                      ║
╠══════════════════════════════════════════╣
║  📍 Local:   http://localhost:${PORT}        ║
║  📡 Network: http://${ip}:${PORT}     ║
║  📡 ApiDocs: http://localhost:${PORT}/api-docs ║
║  🌍 Env:     ${(process.env.NODE_ENV || 'development').padEnd(26)}║
╚══════════════════════════════════════════╝`);

    startKeepAlive();
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});

export default app;
