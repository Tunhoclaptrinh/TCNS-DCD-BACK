import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import axios from 'axios';

dotenv.config();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
});

const app = express();

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
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: process.env.CORS_CREDENTIALS === 'true' || false,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files (Uploads)
const uploadDir = path.join(__dirname, 'database/uploads');
console.log(`📂 Serving static files from: ${uploadDir}`);
app.use('/uploads', express.static(uploadDir));

// Logging
import loggerMiddleware from './src/middleware/logger.middleware';
app.use(loggerMiddleware);

// Query parsing
import { parseQuery, formatResponse, validateQuery, logQuery } from './src/middleware/query.middleware';
app.use(parseQuery);
app.use(formatResponse);
app.use(validateQuery);
app.use(logQuery);

// Apply rate limiting BEFORE routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Swagger
import { setupSwagger } from './src/utils/swagger-auto';
setupSwagger(app);

// Import Routes
import routes from './src/routes';
app.use('/api', routes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Base API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ==================== ERROR HANDLING ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', {
    message: err.message,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.status || err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    error:
      process.env.NODE_ENV === 'development'
        ? {
            type: err.name,
            stack: err.stack,
          }
        : undefined,
  };

  res.status(statusCode).json(response);
});

// ==================== SERVER START ====================

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const { address, family, internal } = iface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
}

// ==================== KEEPER ALIVE SERVICE ====================
const KEEPALIVE_INTERVAL = 14 * 60 * 1000;

function startKeepAlive() {
  const serviceUrl = process.env.PYTHON_SERVICE_URL;
  if (!serviceUrl || serviceUrl.includes('localhost') || serviceUrl.includes('127.0.0.1')) {
    return;
  }

  try {
    const urlObj = new URL(serviceUrl);
    const targetUrl = `${urlObj.origin}/`;

    console.log(`⏰ Keep-alive service started: ${targetUrl}`);

    pingService(targetUrl);

    setInterval(() => {
      pingService(targetUrl);
    }, KEEPALIVE_INTERVAL);
  } catch (err) {
    console.error(err.message);
  }
}

async function pingService(url) {
  try {
    await axios.get(url, { timeout: 10000 });
    console.log(`[${new Date().toISOString()}] 💓 Wake up successful (Status: 200)`);
  } catch (error) {
    if (error.response) {
      console.log(`[${new Date().toISOString()}] 💓 Wake up successful (Status: ${error.response.status})`);
    } else {
      console.error(`[${new Date().toISOString()}] ⚠️ Wake up failed: ${error.message}`);
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const networkIp = getNetworkIp();
  console.log(`✅ Server restart triggered at ${new Date().toISOString()}`);
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║   🚀 Base Server Started!                                ║
╠══════════════════════════════════════════════════════════════════╣
║   📍 Local:   http://localhost:${PORT}                              ║
║   📡 Network: http://${networkIp}:${PORT}                           ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                                    ║
║   📊 API Docs: http://localhost:${PORT}/api                         ║
║   ❤️  Health: http://localhost:${PORT}/api/health                    ║
╚══════════════════════════════════════════════════════════════════╝
  `);

  startKeepAlive();
});

export default app;
