// src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const WebSocket = require('ws');
const passport = require('passport');
const { configureGitHubStrategy } = require('./config/passport');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Import the dedicated Swagger router
const swaggerRouter = require('./routes/swagger');

// ---------------------------------------------------
// Middleware & Configuration
// ---------------------------------------------------

// Logging middleware: logs each request
app.use((req, res, next) => {
  console.log('\n=== Incoming Request ===');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  next();
});

// Parse JSON bodies
app.use(express.json());

// CORS configuration: allow localhost and your production domain
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://www.lebaincode.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  exposedHeaders: ['Set-Cookie']
}));
app.options('*', cors());

// Trust the proxy if behind one
app.set('trust proxy', 1);

app.use(passport.initialize());
app.use(cookieParser());

// Session configuration with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60  // 24 hours
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  }
}));

app.use(passport.session());
configureGitHubStrategy();

// ---------------------------------------------------
// Swagger Documentation
// ---------------------------------------------------

// Mount the dedicated Swagger router at /api-docs
app.use('/api-docs', swaggerRouter);

// ---------------------------------------------------
// API Routes
// ---------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/email', require('./routes/email'));
app.use('/api/admin/analytics', require('./routes/analytics'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/beta', require('./routes/beta'));
app.use('/api/dashboard', require('./routes/dashboard'));

// ---------------------------------------------------
// Development-Only Routes
// ---------------------------------------------------
if (process.env.NODE_ENV === 'development') {
  app.post('/api/auth/test-user', async (req, res) => {
    try {
      const User = require('./models/User');
      console.log('Creating test user...');

      const latestUser = await User.findOne({ role: 'user' })
        .sort({ username: -1 });
      const newUserNumber = latestUser
        ? String(Number(latestUser.username) + 1).padStart(3, '0')
        : '001';

      const testUser = await User.create({
        username: newUserNumber,
        role: 'user',
        progress: {
          cModule: { completed: 0, total: 10 },
          examModule: { completed: 0, total: 4, isUnlocked: false }
        }
      });

      console.log('Test user created:', {
        id: testUser._id,
        username: testUser.username
      });
      res.json(testUser);
    } catch (err) {
      console.error('Test user creation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/debug/session', (req, res) => {
    console.log('\n=== Debug Session Info ===');
    console.log('Session:', req.session);
    res.json({ session: req.session });
  });
}

console.log("GitHub OAuth settings check:");
console.log("Client ID:", process.env.GITHUB_CLIENT_ID ? "Set" : "Missing");
console.log("Client Secret:", process.env.GITHUB_CLIENT_SECRET ? "Set" : "Missing");
console.log("Callback URL:", `${process.env.BACKEND_URL}/api/auth/github/callback`);

// ---------------------------------------------------
// Health Check & Verification Routes
// ---------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/auth/verify-session', (req, res) => {
  console.log('Token from cookies:', req.cookies.token);
  res.send('Check the console for the token');
});

// ---------------------------------------------------
// WebSocket Setup
// ---------------------------------------------------
wss.on('connection', (ws) => {
  console.log('\n=== New WebSocket Connection ===');
  ws.on('message', (message) => {
    try {
      const { type, data } = JSON.parse(message.toString());
      console.log('WebSocket message received:', { type, data });
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, data }));
        }
      });
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// ---------------------------------------------------
// Error Handling Middleware
// ---------------------------------------------------
app.use((err, req, res, next) => {
  console.error('\n=== Error Handler ===');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ---------------------------------------------------
// Static Files & Root Route
// ---------------------------------------------------
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Le Bain Code API</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f5f5f5; color: #333; }
        .logo-image { max-width: 200px; margin-bottom: 20px; }
        .logo { font-size: 3rem; font-weight: bold; margin-bottom: 20px; color: #0066cc; }
        .message { font-size: 1.2rem; }
        .swagger-link { margin-top: 20px; padding: 10px 20px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; }
        .swagger-link:hover { background-color: #0052a3; }
      </style>
    </head>
    <body>
      <img src="/logo.png" alt="Le Bain Code" class="logo-image">
      <div class="logo">Le Bain Code</div>
      <div class="message">API server is running correctly</div>
      <a href="/api-docs" class="swagger-link">View API Documentation</a>
    </body>
    </html>
  `);
});

// ---------------------------------------------------
// Database Connection & Server Startup
// ---------------------------------------------------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n=== Server Started ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log('BACKEND_URL:', process.env.BACKEND_URL);
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  console.log('GitHub callback URL:', `${process.env.BACKEND_URL}/api/auth/github/callback`);
  console.log('Swagger API documentation available at:', `http://localhost:${PORT}/api-docs`);
  console.log('Production Swagger documentation at:', `https://lebaincode-backend.onrender.com/api-docs`);
});
