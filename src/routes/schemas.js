/**
 * @swagger
 * components:
 *   schemas:
 *     Module:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the module
 *         name:
 *           type: string
 *           description: Name of the module
 *         slug:
 *           type: string
 *           description: URL-friendly identifier for the module
 *         description:
 *           type: string
 *           description: Detailed description of the module
 *         order:
 *           type: integer
 *           description: Order in which modules should be presented
 *         isPaid:
 *           type: boolean
 *           description: Whether the module requires payment to access
 *         prerequisiteModule:
 *           type: string
 *           description: ID of the module that must be completed before accessing this one
 *         prerequisiteScore:
 *           type: integer
 *           description: Minimum score required on prerequisite module test
 *         notions:
 *           type: array
 *           items:
 *             type: string
 *           description: Programming concepts covered in this module
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         _id: "60d21b4967d0d8992e610c85"
 *         name: "GitHub Basics"
 *         slug: "github"
 *         description: "Learn the fundamentals of Git and GitHub for version control and collaboration."
 *         order: 1
 *         isPaid: false
 *         notions: ["git", "repository", "commit", "branch", "pull request"]
 *         createdAt: "2025-05-01T12:00:00Z"
 *         updatedAt: "2025-05-01T12:00:00Z"
 *     
 *     ModuleDay:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         moduleId:
 *           type: string
 *           description: ID of the parent module
 *         dayNumber:
 *           type: integer
 *           description: Day number within the module
 *         title:
 *           type: string
 *           description: Title of this day's content
 *         description:
 *           type: string
 *           description: Description of this day's content
 *         exercises:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Exercise'
 *         notions:
 *           type: array
 *           items:
 *             type: string
 *       example:
 *         _id: "60d21b4967d0d8992e610c86"
 *         moduleId: "60d21b4967d0d8992e610c85"
 *         dayNumber: 1
 *         title: "Day 1: Introduction to Git & GitHub"
 *         description: "Learn the basics of version control and why GitHub is essential for developers."
 *         exercises: [
 *           {
 *             title: "Exercise 1.1: Installing Git",
 *             description: "Install Git on your machine and configure your identity",
 *             content: "# Installing Git\n\nIn this exercise...",
 *             order: 1
 *           }
 *         ]
 *         notions: ["version control", "git basics", "repositories"]
 *     
 *     Exercise:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         content:
 *           type: string
 *         order:
 *           type: integer
 *       example:
 *         title: "Exercise 1.1: Installing Git"
 *         description: "Install Git on your machine and configure your identity"
 *         content: "# Installing Git\n\nIn this exercise..."
 *         order: 1
 *     
 *     ModuleTest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         moduleId:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         timeLimit:
 *           type: integer
 *           description: Time limit in minutes
 *         passingScore:
 *           type: integer
 *           description: Minimum score to pass (percentage)
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TestQuestion'
 *       example:
 *         _id: "60d21b4967d0d8992e610c87"
 *         moduleId: "60d21b4967d0d8992e610c85"
 *         title: "GitHub Proficiency Test"
 *         description: "Test your knowledge of GitHub fundamentals"
 *         timeLimit: 30
 *         passingScore: 60
 *     
 *     TestQuestion:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         question:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuestionOption'
 *         type:
 *           type: string
 *           enum: [multiple-choice, true-false, coding]
 *         points:
 *           type: integer
 *       example:
 *         _id: "60d21b4967d0d8992e610c88"
 *         question: "What is Git?"
 *         options: [
 *           { "_id": "opt1", "text": "A programming language", "isCorrect": false },
 *           { "_id": "opt2", "text": "A version control system", "isCorrect": true }
 *         ]
 *         type: "multiple-choice"
 *         points: 1
 *     
 *     QuestionOption:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         text:
 *           type: string
 *       example:
 *         _id: "opt1"
 *         text: "A programming language"
 *     
 *     TestSubmission:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         moduleTestId:
 *           type: string
 *         answers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: string
 *               selectedOptionId:
 *                 type: string
 *         score:
 *           type: number
 *         passed:
 *           type: boolean
 *         completedAt:
 *           type: string
 *           format: date-time
 *     
 *     BetaApplication:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         occupation:
 *           type: string
 *         discordId:
 *           type: string
 *         reason:
 *           type: string
 *         submittedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         email: "user@example.com"
 *         occupation: "Software Developer"
 *         discordId: "user#1234"
 *         reason: "I want to help test new features"
 *         submittedAt: "2025-05-01T12:00:00Z"
 *     
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalHoursSpent:
 *           type: number
 *         exercisesCompleted:
 *           type: integer
 *         totalExercises:
 *           type: integer
 *         completionPercentage:
 *           type: number
 *         notionsMastered:
 *           type: integer
 *         daysCompleted:
 *           type: integer
 *         totalDays:
 *           type: integer
 *       example:
 *         totalHoursSpent: 12
 *         exercisesCompleted: 24
 *         totalExercises: 40
 *         completionPercentage: 60
 *         notionsMastered: 15
 *         daysCompleted: 6
 *         totalDays: 10
 *     
 *     ModuleProgress:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         accessStatus:
 *           type: string
 *           enum: [unlocked, locked, requires-prerequisite, requires-payment, partial-beta]
 *         progress:
 *           type: object
 *           properties:
 *             started:
 *               type: boolean
 *             completed:
 *               type: boolean
 *             percentage:
 *               type: number
 *         testScore:
 *           type: number
 *           nullable: true
 *         testPassed:
 *           type: boolean
 *       example:
 *         id: "60d21b4967d0d8992e610c85"
 *         name: "GitHub Basics"
 *         slug: "github"
 *         description: "Learn the fundamentals of Git and GitHub"
 *         accessStatus: "unlocked"
 *         progress:
 *           started: true
 *           completed: false
 *           percentage: 40
 *         testScore: 70
 *         testPassed: true
 *     
 *     SecuritySettings:
 *       type: object
 *       properties:
 *         twoFactorEnabled:
 *           type: boolean
 *         notifyOnLogin:
 *           type: boolean
 *         ipRestriction:
 *           type: string
 *           nullable: true
 *       example:
 *         twoFactorEnabled: false
 *         notifyOnLogin: true
 *         ipRestriction: null
 *
 *     SecurityScore:
 *       type: object
 *       properties:
 *         securityScore:
 *           type: integer
 *           description: Security score from 0-100
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *         level:
 *           type: string
 *           enum: [strong, good, needs-improvement]
 *       example:
 *         securityScore: 75
 *         recommendations: ["Set a strong password that is at least 12 characters long"]
 *         level: "good"
 *
 *     AccountActivity:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [login, password_change, beta_application, beta_approval]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         details:
 *           type: object
 *       example:
 *         type: "login"
 *         timestamp: "2025-05-01T12:00:00Z"
 *         details: { "ip": "192.168.1.1", "userAgent": "Mozilla/5.0..." }
 *
 *     Analytics:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *         totalVisits:
 *           type: integer
 *         uniqueVisitors:
 *           type: integer
 *         pageViews:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PageView'
 *         mostVisitedPages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               path:
 *                 type: string
 *               count:
 *                 type: integer
 *       example:
 *         date: "2025-05-01"
 *         totalVisits: 150
 *         uniqueVisitors: 75
 *         mostVisitedPages: [
 *           { "path": "/dashboard", "count": 45 },
 *           { "path": "/modules/github", "count": 32 }
 *         ]
 *
 *     PageView:
 *       type: object
 *       properties:
 *         path:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         duration:
 *           type: number
 *         userAgent:
 *           type: string
 *         ip:
 *           type: string
 *       example:
 *         path: "/dashboard"
 *         timestamp: "2025-05-01T12:30:45Z"
 *         duration: 120
 *         userAgent: "Mozilla/5.0..."
 *         ip: "192.168.1.1"
 */
