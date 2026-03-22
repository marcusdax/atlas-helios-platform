console.log('Server.js starting...');

process.on('unhandledRejection', (reason, promise) => {
  console.log('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION:', err);
});

console.log('About to require database');
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

console.log('About to require database...');
// Database
const db = require('./config/database');
console.log('Database required');

console.log('About to require services...');
// Services
const StormService = require('./src/services/StormService');
const PropertyService = require('./src/services/PropertyService');
let ComputerVisionService;
try {
  ComputerVisionService = require('./src/services/ComputerVisionService');
} catch (e) {
  console.warn('ComputerVisionService not available - AI features disabled');
  ComputerVisionService = null;
}

// Nexus Mind AI Integration
let NexusMindIntegration;
try {
  NexusMindIntegration = require('./src/integrations/NexusMindIntegration');
  console.log('Nexus Mind Integration loaded');
} catch (e) {
  console.warn('Nexus Mind Integration not available:', e.message);
  NexusMindIntegration = null;
}

// NOAA Weather Service Integration
let NOAAWeatherService;
try {
  NOAAWeatherService = require('./src/services/NOAAWeatherService');
  console.log('NOAA Weather Service loaded');
} catch (e) {
  console.warn('NOAA Weather Service not available:', e.message);
  NOAAWeatherService = null;
}
console.log('Services required');

// Routes
console.log('About to require routes...');
const authRoutes = require('./src/routes/authRoutes');
console.log('authRoutes OK');
const stormRoutes = require('./src/routes/stormRoutes');
console.log('stormRoutes OK');
const propertyRoutes = require('./src/routes/propertyRoutes');
console.log('propertyRoutes OK');
const assessmentRoutes = require('./src/routes/assessmentRoutes');
console.log('assessmentRoutes OK');
const leadRoutes = require('./src/routes/leadRoutes');
console.log('leadRoutes OK');
const estimateRoutes = require('./src/routes/estimateRoutes');
console.log('estimateRoutes OK');
const nexusRoutes = require('./src/routes/nexusRoutes');
console.log('nexusRoutes OK');
const weatherRoutes = require('./src/routes/weatherRoutes');
console.log('weatherRoutes OK');
console.log('Routes required');

// Middleware
console.log('About to require middleware...');
const { authMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/errorHandler');
const { logger } = require('./src/utils/logger');
console.log('Middleware required');

const app = express();
console.log('Express app created');
const server = http.createServer(app);
console.log('HTTP server created');

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

console.log('Setting up Socket.IO...');
// Socket.IO Setup
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});
console.log('Socket.IO setup complete');

console.log('Setting up middleware...');
// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  }
}));

console.log('Setting up cors...');
app.use(cors(corsOptions));
console.log('Setting up compression...');
app.use(compression());
console.log('Setting up morgan...');
app.use(morgan('combined', { stream: logger.stream }));
console.log('Setting up express.json...');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting
console.log('Setting up rate limiting...');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

console.log('Setting up health check...');
// Health Check
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'postgresql',
    uptime: process.uptime(),
    integrations: {}
  };

  // Check Nexus Mind status
  if (NexusMindIntegration) {
    try {
      const nexusStatus = NexusMindIntegration.getStatus();
      healthStatus.integrations.nexus_mind = nexusStatus;
    } catch (e) {
      healthStatus.integrations.nexus_mind = { error: e.message };
    }
  }

  // Check NOAA Weather Service status
  if (NOAAWeatherService) {
    try {
      const weatherStatus = NOAAWeatherService.getStatus();
      healthStatus.integrations.noaa_weather = weatherStatus;
    } catch (e) {
      healthStatus.integrations.noaa_weather = { error: e.message };
    }
  }

  res.status(200).json(healthStatus);
});

console.log('Setting up API routes...');
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/storms', stormRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/nexus', nexusRoutes);
app.use('/api/weather', weatherRoutes);

// Protected routes (require authentication)
app.use('/api/private', authMiddleware, (req, res) => {
  res.json({ message: 'Private route access granted' });
});

// Error Handling
console.log('Setting up error handling...');
app.use(errorHandler);

// Socket.IO Events
console.log('Setting up Socket.IO events...');
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join room based on user role
  socket.on('join_room', (room) => {
    socket.join(room);
    logger.info(`Socket ${socket.id} joined room: ${room}`);
  });

  // Storm-related events
  socket.on('subscribe_storms', () => {
    socket.join('storm_alerts');
    logger.info(`Socket ${socket.id} subscribed to storm alerts`);
  });

  socket.on('unsubscribe_storms', () => {
    socket.leave('storm_alerts');
    logger.info(`Socket ${socket.id} unsubscribed from storm alerts`);
  });

  // Property assessment events
  socket.on('subscribe_assessments', () => {
    socket.join('property_assessments');
    logger.info(`Socket ${socket.id} subscribed to property assessments`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Initialize Services
const initializeServices = async () => {
  try {
    // Start Storm Service
    await StormService.initialize(io);
    logger.info('Storm Service initialized');

    // Start Property Service
    await PropertyService.initialize(io);
    logger.info('Property Service initialized');

    // Initialize Computer Vision Service (if available)
    if (ComputerVisionService) {
      await ComputerVisionService.initialize();
      logger.info('Computer Vision Service initialized');
    }

    // Initialize Nexus Mind AI Integration
    if (NexusMindIntegration && process.env.ENABLE_NEXUS_COGNITIVE === 'true') {
      try {
        const nexusStatus = await NexusMindIntegration.initialize({
          device: 'cpu',
          perceptionConfig: process.env.PERCEPTION_CONFIG || 'PE-Core-B16-224'
        });
        logger.info('Nexus Mind AI Integration initialized:', nexusStatus);
      } catch (nexusError) {
        logger.warn('Nexus Mind AI Integration failed to initialize:', nexusError.message);
      }
    }

    // Initialize NOAA Weather Service
    if (NOAAWeatherService) {
      try {
        const weatherStatus = await NOAAWeatherService.initialize();
        logger.info('NOAA Weather Service initialized:', weatherStatus);
      } catch (weatherError) {
        logger.warn('NOAA Weather Service failed to initialize:', weatherError.message);
      }
    }

  } catch (error) {
    logger.error('Service initialization failed:', error);
  }
};

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

console.log('About to call server.listen on port', PORT);

server.listen(PORT, async () => {
  console.log('Server listen callback triggered');
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize database connection
  try {
    await db.raw('SELECT 1');
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
  }

  // Initialize services
  await initializeServices();
}).on('error', (err) => {
  console.error('Server listen error:', err);
  logger.error('Server listen error:', err);
});