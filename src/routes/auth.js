/**
 * src/routes/auth.js
 *
 * Authentication routes for the application including GitHub OAuth, local admin login,
 * logout, and session verification. In development, a test-user route is available.
 */

const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication including GitHub OAuth and admin login
 */

const debug = (message, data) => {
  console.log(`[Auth Route] ${message}`, data || '');
};

/**
 * @swagger
 * /api/auth/check:
 *   get:
 *     summary: Check if the user is authenticated
 *     description: Verifies the JWT token stored in cookies and returns authentication status
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication status checked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                   description: Whether the user is authenticated
 *                 user:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User ID
 *                     username:
 *                       type: string
 *                       description: Username
 *                     role:
 *                       type: string
 *                       enum: [user, beta, admin]
 *                       description: User role
 *                     progress:
 *                       type: object
 *                       description: User progress data
 *             examples:
 *               authenticated:
 *                 summary: Authenticated user
 *                 value:
 *                   authenticated: true
 *                   user:
 *                     id: "60d21b4967d0d8992e610c85"
 *                     username: "001"
 *                     role: "user"
 *                     progress: {}
 *               unauthenticated:
 *                 summary: Unauthenticated user
 *                 value:
 *                   authenticated: false
 *                   user: null
 */
router.get('/check', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ authenticated: false, user: null });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findById(decoded.userId)
      .then(user => {
        if (!user) {
          return res.json({ authenticated: false, user: null });
        }
        res.json({
          authenticated: true,
          user: {
            id: user._id,
            username: user.username,
            role: user.role,
            progress: user.progress
          }
        });
      })
      .catch(err => {
        console.error('User lookup error:', err);
        res.json({ authenticated: false, user: null });
      });
  } catch (error) {
    console.error('Token verification error:', error);
    res.json({ authenticated: false, user: null });
  }
});

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth authentication flow
 *     description: Redirects the user to GitHub for OAuth authentication
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to GitHub authorization page
 *         headers:
 *           Location:
 *             description: GitHub OAuth URL
 *             schema:
 *               type: string
 *               example: "https://github.com/login/oauth/authorize?client_id=..."
 */
router.get('/github', (req, res, next) => {
  debug('Starting GitHub authentication');
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false
  })(req, res, next);
});

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: Handle GitHub OAuth callback
 *     description: Processes the callback from GitHub OAuth, generates JWT token, and redirects to frontend
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: GitHub authorization code
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: OAuth state parameter
 *     responses:
 *       302:
 *         description: Successful authentication - redirects to frontend dashboard
 *         headers:
 *           Set-Cookie:
 *             description: JWT token set as HTTP-only cookie
 *             schema:
 *               type: string
 *               example: "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=None; Max-Age=86400"
 *           Location:
 *             description: Frontend callback URL
 *             schema:
 *               type: string
 *               example: "https://frontend.com/auth/callback"
 *       401:
 *         description: Authentication failed - redirects to login with error
 *         headers:
 *           Location:
 *             description: Frontend login URL with error parameter
 *             schema:
 *               type: string
 *               example: "https://frontend.com/login?error=auth_failed"
 */
router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    session: false,
  }, async (err, user) => {
    if (err) {
      console.error('GitHub callback error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
    if (!user) {
      console.error('No user returned from GitHub');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
    }
    try {
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback`);
    } catch (error) {
      console.error('Token generation error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_failed`);
    }
  })(req, res, next);
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Admin login with username and password
 *     description: Authenticates admin users with credentials, generates JWT token, and updates login history
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Admin username
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Admin password
 *                 example: "SecurePassword123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: JWT token set as HTTP-only cookie
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "60d21b4967d0d8992e610c85"
 *                     username:
 *                       type: string
 *                       example: "admin"
 *                     role:
 *                       type: string
 *                       example: "admin"
 *                     progress:
 *                       type: object
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid credentials"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Add validation
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // CRITICAL FIX: Add .select('+password') to get the password field
    const user = await User.findOne({ username }).select('+password');
    
    if (!user || user.role !== 'admin') {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check if password exists before comparing
    if (!user.password) {
      console.log('User has no password set:', username);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    user.security = {
      lastLogin: new Date(),
      loginHistory: [
        ...(user.security?.loginHistory || []),
        {
          timestamp: new Date(),
          provider: 'organizational',
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      ].slice(-5)
    };
    await user.save();
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        progress: user.progress
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/auth/user/profile:
 *   get:
 *     summary: Get authenticated user's detailed profile
 *     description: Retrieves comprehensive profile information for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "60d21b4967d0d8992e610c85"
 *                     username:
 *                       type: string
 *                       example: "001"
 *                     role:
 *                       type: string
 *                       enum: [user, beta, admin]
 *                       example: "user"
 *                     progress:
 *                       type: object
 *                       description: User's learning progress
 *                     security:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         lastLogin:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */
router.get('/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        progress: user.progress,
        security: user.security ? {
          lastLogin: user.security.lastLogin
        } : null
      }
    });
  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/auth/verify-session:
 *   get:
 *     summary: Verify user session
 *     description: Protected route that verifies if the user's session is valid
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "60d21b4967d0d8992e610c85"
 *                     username:
 *                       type: string
 *                       example: "001"
 *                     role:
 *                       type: string
 *                       enum: [user, beta, admin]
 *                       example: "user"
 *       401:
 *         description: Unauthorized - invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 */
router.get('/verify-session', verifyToken, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     description: Clears the authentication cookie to log out the user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         headers:
 *           Set-Cookie:
 *             description: Clears the authentication token cookie
 *             schema:
 *               type: string
 *               example: "token=; HttpOnly; Secure; SameSite=None; Max-Age=0"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * Development-only routes - Only available when NODE_ENV is set to "development"
 */
if (process.env.NODE_ENV === 'development') {
  /**
   * @swagger
   * /api/auth/test-user:
   *   post:
   *     summary: Create a test user (Development only)
   *     description: Creates a test user for development purposes. Only available in development environment.
   *     tags: [Authentication]
   *     responses:
   *       200:
   *         description: Test user created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                   example: "60d21b4967d0d8992e610c85"
   *                 username:
   *                   type: string
   *                   example: "001"
   *                 githubId:
   *                   type: string
   *                   example: "test1640995200000"
   *                 role:
   *                   type: string
   *                   example: "user"
   *                 progress:
   *                   type: object
   *                   properties:
   *                     cModule:
   *                       type: object
   *                       properties:
   *                         completed:
   *                           type: number
   *                           example: 0
   *                         total:
   *                           type: number
   *                           example: 10
   *                     examModule:
   *                       type: object
   *                       properties:
   *                         completed:
   *                           type: number
   *                           example: 0
   *                         total:
   *                           type: number
   *                           example: 4
   *                         isUnlocked:
   *                           type: boolean
   *                           example: false
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *                 updatedAt:
   *                   type: string
   *                   format: date-time
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Error message"
   */
  router.post('/test-user', async (req, res) => {
    try {
      const latestUser = await User.findOne({ role: 'user' }).sort({ username: -1 });
      const newUserNumber = latestUser 
        ? String(Number(latestUser.username) + 1).padStart(3, '0')
        : '001';
      const testUser = await User.create({
        username: newUserNumber,
        githubId: `test${Date.now()}`,
        role: 'user',
        progress: {
          cModule: { completed: 0, total: 10 },
          examModule: { completed: 0, total: 4, isUnlocked: false }
        }
      });
      debug('Test user created', { username: testUser.username });
      res.json(testUser);
    } catch (err) {
      debug('Test user creation error', err);
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * @swagger
 * /api/auth/health:
 *   get:
 *     summary: Health check for authentication service
 *     description: Verifies that the authentication API server is running and responsive
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: API is healthy and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-05-30T22:30:45.123Z"
 *                 service:
 *                   type: string
 *                   example: "authentication"
 */
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'authentication'
  });
});

module.exports = router;