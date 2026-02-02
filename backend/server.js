require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Database
const db = require('./config/database');

// Services
const StormService = require('./src/services/StormService');
const PropertyService = require('./src/services/PropertyService');
const ComputerVisionService = require('./src/services/ComputerVisionService');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const stormRoutes = require('./src/routes/stormRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');
const assessmentRoutes = require('./src/routes/assessmentRoutes');
const leadRoutes = require('./src/routes/leadRoutes');
const estimateRoutes = require('./src/routes/estimateRoutes');

// Middleware
const authMiddleware = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const app = express();
const server = http.createServer(app);

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

// Socket.IO Setup
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

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

app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    database: db.client,
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/storms', stormRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/estimates', estimateRoutes);

// Protected routes (require authentication)
app.use('/api/private', authMiddleware, (req, res) => {
  res.json({ message: 'Private route access granted' });
});

// Error Handling
app.use(errorHandler);

// Socket.IO Events
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

    // Initialize Computer Vision Service
    await ComputerVisionService.initialize();
    logger.info('Computer Vision Service initialized');

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

server.listen(PORT, async () => {
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
});