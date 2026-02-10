const express = require('express');
const cors = require('cors');
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later'
});


const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));


// Middleware
const path = require('path');
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: process.env.CORS_CREDENTIALS === 'true' || false
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files (Uploads)
const uploadDir = path.join(__dirname, 'database/uploads');
console.log(`📂 Serving static files from: ${uploadDir}`);
app.use('/uploads', express.static(uploadDir));

// Logging
app.use(require('./middleware/logger.middleware'));

// Query parsing
const { parseQuery, formatResponse, validateQuery, logQuery } = require('./middleware/query.middleware');
app.use(parseQuery);
app.use(formatResponse);
app.use(validateQuery);
app.use(logQuery);

// Apply rate limiting BEFORE routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Import Routes
// Mount all routes
app.use('/api', require('./routes'));

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'Base Backend API',
    version: '1.0.0',
    description: 'Generic Backend API Starter',
    documentation: 'DOCS_URL_HERE',
    endpoints: {
      // Authentication
      auth: {
        base: '/api/auth',
        routes: [
          'POST /api/auth/register',
          'POST /api/auth/login',
          'GET /api/auth/me',
          'POST /api/auth/logout',
          'PUT /api/auth/change-password'
        ]
      },

      // Users
      users: {
        base: '/api/users',
        routes: [
          'GET /api/users',
          'GET /api/users/:id',
          'PUT /api/users/profile',
          'GET /api/users/stats/summary'
        ]
      }
    },

    // Query parameters
    queryParams: {
      pagination: '?_page=1&_limit=10',
      sorting: '?_sort=name&_order=asc',
      filtering: '?field_gte=1000&field_lte=2000',
      search: '?q=search_term',
      nearby: '?latitude=21.0285&longitude=105.8542&radius=5'
    },

    // Response format
    responseFormat: {
      success: {
        success: true,
        message: 'Operation successful',
        data: {}
      },
      error: {
        success: false,
        message: 'Error message',
        statusCode: 400
      },
      paginated: {
        success: true,
        count: 10,
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10,
          hasNext: true,
          hasPrev: false
        }
      }
    },

    // Authentication
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>',
      testAccounts: {
        admin: 'admin@example.com / 123456',
        user: 'user@example.com / 123456'
      }
    }
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Base API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== ERROR HANDLING ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', {
    message: err.message,
    path: req.path,
    method: req.method
  });

  const statusCode = err.status || err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? {
      type: err.name,
      stack: err.stack
    } : undefined
  };

  res.status(statusCode).json(response);
});

// ==================== SERVER START ====================

const os = require('os');

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      const { address, family, internal } = interface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
}

// ==================== KEEPER ALIVE SERVICE ====================
const axios = require('axios');
const KEEPALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes

function startKeepAlive() {
  const serviceUrl = process.env.PYTHON_SERVICE_URL;
  if (!serviceUrl || serviceUrl.includes('localhost') || serviceUrl.includes('127.0.0.1')) {
    return;
  }

  // Extract base URL from service URL
  try {
    const urlObj = new URL(serviceUrl);
    const targetUrl = `${urlObj.origin}/`; // Ping root path always

    console.log(`⏰ Keep-alive service started: ${targetUrl}`);

    // Initial ping
    pingService(targetUrl);

    // Periodic ping
    setInterval(() => {
      pingService(targetUrl);
    }, KEEPALIVE_INTERVAL);

  } catch (err) {
    console.error(err.message);
  }
}

async function pingService(url) {
  try {
    // GET request to root should return 200 OK
    await axios.get(url, { timeout: 10000 });
    console.log(`[${new Date().toISOString()}] 💓 Wake up successful (Status: 200)`);
  } catch (error) {
    // If root doesn't exist but we got a response, that's still a wake-up success (e.g. 404)
    // But 405 means method not allowed, which is what we want to avoid.
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

  // Start Keep Alive
  startKeepAlive();
});

module.exports = app;