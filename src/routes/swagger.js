/**
 * @swagger
 * tags:
 *   - name: Email
 *     description: Email management operations
 *   - name: Authentication
 *     description: User authentication including GitHub OAuth
 *   - name: Admin
 *     description: Administrative operations for user management
 *   - name: Analytics
 *     description: User analytics and data collection
 *   - name: Health
 *     description: Server health monitoring
 * 
 * components:
 *   schemas:
 *     Email:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *       example:
 *         email: user@example.com
 *     
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID
 *         username:
 *           type: string
 *           description: User's username
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         role:
 *           type: string
 *           enum: [user, admin]
 *           description: User's role
 *         progress:
 *           type: object
 *           properties:
 *             cModule:
 *               type: object
 *               properties:
 *                 completed:
 *                   type: number
 *                 total:
 *                   type: number
 *             examModule:
 *               type: object
 *               properties:
 *                 completed:
 *                   type: number
 *                 total:
 *                   type: number
 *                 isUnlocked:
 *                   type: boolean
 *       example:
 *         _id: "60d21b4967d0d8992e610c85"
 *         username: "001"
 *         email: "user@example.com"
 *         role: "user"
 *         progress:
 *           cModule:
 *             completed: 0
 *             total: 10
 *           examModule:
 *             completed: 0
 *             total: 4
 *             isUnlocked: false
 *     
 *     Prospect:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Prospect's email address
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when prospect was created
 *         type:
 *           type: string
 *           enum: [individual, organization]
 *           description: Type of prospect
 *         reachedOut:
 *           type: boolean
 *           description: Whether the prospect has been contacted
 *         comment:
 *           type: string
 *           description: Admin comments about the prospect
 *       example:
 *         email: "prospect@example.com"
 *         createdAt: "2025-05-01T12:00:00Z"
 *         type: "individual"
 *         reachedOut: false
 *         comment: ""
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check API health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 */

/**
 * @swagger
 * /api/email/all:
 *   get:
 *     summary: Get all user emails (admin only)
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of all user emails
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 format: email
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 * 
 * /api/email/check-user:
 *   post:
 *     summary: Check if an email exists in users collection
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Email'
 *     responses:
 *       200:
 *         description: Email exists status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       500:
 *         description: Server error
 * 
 * /api/email/check-prospect:
 *   post:
 *     summary: Check if an email exists in prospects collection
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Email'
 *     responses:
 *       200:
 *         description: Email exists status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       500:
 *         description: Server error
 * 
 * /api/email/check:
 *   post:
 *     summary: Check if an email exists in both users and prospects
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Email'
 *     responses:
 *       200:
 *         description: Email exists status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 existsInUsers:
 *                   type: boolean
 *                 existsInProspects:
 *                   type: boolean
 *       500:
 *         description: Server error
 * 
 * /api/email/save-prospect:
 *   post:
 *     summary: Save a new prospect email
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Email'
 *     responses:
 *       201:
 *         description: Prospect saved successfully
 *       400:
 *         description: Email already exists
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth flow
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to GitHub authorization page
 * 
 * /api/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback endpoint
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: GitHub authorization code
 *     responses:
 *       302:
 *         description: Redirects to frontend with JWT token
 *       401:
 *         description: Authentication failed
 * 
 * /api/auth/login:
 *   post:
 *     summary: Login for admin users
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication failed
 * 
 * /api/auth/user/profile:
 *   get:
 *     summary: Get authenticated user's profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 * 
 * /api/auth/check:
 *   get:
 *     summary: Check if the user is authenticated
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User is authenticated
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/admin/users/count:
 *   get:
 *     summary: Get total count of users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 * 
 * /api/admin/prospects:
 *   get:
 *     summary: Get all prospects
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of prospects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Prospect'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 * 
 * /api/admin/prospects/{email}/type:
 *   put:
 *     summary: Update the type of a prospect
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Prospect email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [individual, organization]
 *     responses:
 *       200:
 *         description: Prospect type updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Prospect not found
 * 
 * /api/admin/users:
 *   get:
 *     summary: Get all regular users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 * 
 * /api/admin/analytics:
 *   get:
 *     summary: Get analytics data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 */

