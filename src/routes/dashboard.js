// routes/dashboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Module = require('../models/Module');
const verifyToken = require('../middleware/verifyToken');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: User dashboard endpoints
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get user dashboard data
 *     description: Retrieves comprehensive user progress data including module progress, test scores, and beta access status
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     hasBetaAccess:
 *                       type: boolean
 *                     hasPaidAccess:
 *                       type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalHoursSpent:
 *                       type: number
 *                     exercisesCompleted:
 *                       type: number
 *                     totalExercises:
 *                       type: number
 *                     completionPercentage:
 *                       type: number
 *                     notionsMastered:
 *                       type: number
 *                     daysCompleted:
 *                       type: number
 *                     totalDays:
 *                       type: number
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       description:
 *                         type: string
 *                       accessStatus:
 *                         type: string
 *                         enum: [unlocked, locked, requires-prerequisite, requires-payment, partial-beta]
 *                       progress:
 *                         type: object
 *                         properties:
 *                           started:
 *                             type: boolean
 *                           completed:
 *                             type: boolean
 *                           percentage:
 *                             type: number
 *                       testScore:
 *                         type: number
 *                       testPassed:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    // Get fresh user data with populated details
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get all modules
    const modules = await Module.find().sort('order');
    
    // Process modules for user progress
    const processedModules = await Promise.all(modules.map(async module => {
      // Find user's progress for this module
      const userModuleProgress = user.progress.modules.find(
        m => m.moduleId && m.moduleId.toString() === module._id.toString()
      );
      
      // Find user's test score for this module
      const userTestScore = user.progress.testScores.find(
        t => t.moduleId && t.moduleId.toString() === module._id.toString()
      );
      
      // Determine module access status
      let accessStatus = 'locked';
      let progressPercentage = 0;
      let moduleStarted = false;
      let moduleCompleted = false;
      
      // Process user progress
      if (userModuleProgress) {
        moduleStarted = userModuleProgress.started;
        moduleCompleted = userModuleProgress.completed;
        
        // Calculate progress percentage if module has been started
        if (moduleStarted) {
          // Assume each module's day has equal weight
          const totalDays = module.days ? module.days.length : 0;
          const completedDays = userModuleProgress.days.filter(d => d.completed).length;
          
          if (totalDays > 0) {
            progressPercentage = Math.round((completedDays / totalDays) * 100);
          }
        }
      }
      
      // GitHub module is accessible to all
      if (module.slug === 'github') {
        accessStatus = 'unlocked';
      } 
      // Admin can access everything
      else if (user.role === 'admin') {
        accessStatus = 'unlocked';
      }
      // Beta users can access Shell module (but with limitations)
      else if (user.role === 'beta' && module.slug === 'shell') {
        const githubModule = modules.find(m => m.slug === 'github');
        const githubTestPassed = user.progress.testScores.some(
          score => 
            githubModule && 
            score.moduleId && 
            score.moduleId.toString() === githubModule._id.toString() &&
            score.score >= 60
        );
        
        if (githubTestPassed) {
          accessStatus = 'partial-beta';
        } else {
          accessStatus = 'requires-prerequisite';
        }
      }
      // Handle paid modules
      else if (module.isPaid) {
        // Check if user has paid access
        if (user.payment && user.payment.hasPaidAccess) {
          // If module has prerequisite, check if it's completed with passing score
          if (module.prerequisiteModule) {
            const prerequisiteModulePassed = user.progress.testScores.some(
              score => 
                score.moduleId && 
                score.moduleId.toString() === module.prerequisiteModule.toString() &&
                score.score >= (module.prerequisiteScore || 60)
            );
            
            if (prerequisiteModulePassed) {
              accessStatus = 'unlocked';
            } else {
              accessStatus = 'requires-prerequisite';
            }
          } else {
            accessStatus = 'unlocked';
          }
        } else {
          accessStatus = 'requires-payment';
        }
      }
      // Regular modules with prerequisites
      else if (module.prerequisiteModule) {
        const prerequisiteModulePassed = user.progress.testScores.some(
          score => 
            score.moduleId && 
            score.moduleId.toString() === module.prerequisiteModule.toString() &&
            score.score >= (module.prerequisiteScore || 60)
        );
        
        if (prerequisiteModulePassed) {
          accessStatus = 'unlocked';
        } else {
          accessStatus = 'requires-prerequisite';
        }
      }
      
      return {
        id: module._id,
        name: module.name,
        slug: module.slug,
        description: module.description,
        order: module.order,
        isPaid: module.isPaid,
        accessStatus,
        progress: {
          started: moduleStarted,
          completed: moduleCompleted,
          percentage: progressPercentage
        },
        testScore: userTestScore ? userTestScore.score : null,
        testPassed: userTestScore ? userTestScore.score >= 60 : false,
        testAttempts: userTestScore ? userTestScore.attempts : 0
      };
    }));
    
    // Calculate overall stats
    const stats = {
      totalHoursSpent: user.progress.totalHoursSpent || 0,
      notionsMastered: user.progress.notionsMastered ? user.progress.notionsMastered.length : 0
    };
    
    // Count completed and total exercises across all modules
    let exercisesCompleted = 0;
    let totalExercises = 0;
    let daysCompleted = 0;
    let totalDays = 0;
    
    user.progress.modules.forEach(module => {
      if (module.days) {
        module.days.forEach(day => {
          if (day.exercises) {
            exercisesCompleted += day.exercises.filter(e => e.completed).length;
            totalExercises += day.exercises.length;
          }
          if (day.completed) {
            daysCompleted++;
          }
          totalDays++;
        });
      }
    });
    
    stats.exercisesCompleted = exercisesCompleted;
    stats.totalExercises = totalExercises;
    stats.completionPercentage = totalExercises > 0 ? Math.round((exercisesCompleted / totalExercises) * 100) : 0;
    stats.daysCompleted = daysCompleted;
    stats.totalDays = totalDays;
    
    // Format response
    res.status(200).json({
      success: true,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        hasBetaAccess: user.role === 'beta' || user.betaAccess?.isEnabled,
        hasPaidAccess: user.payment?.hasPaidAccess || false,
        githubProfile: user.githubProfile
      },
      stats,
      modules: processedModules
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard data'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/modules/{moduleId}/progress:
 *   get:
 *     summary: Get detailed progress for a specific module
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the module
 *     responses:
 *       200:
 *         description: Module progress data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Module not found
 *       500:
 *         description: Server error
 */
router.get('/modules/:moduleId/progress', verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    const module = await Module.findById(moduleId);
    
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found'
      });
    }
    
    // Get user progress for this module
    const moduleProgress = user.progress.modules.find(
      m => m.moduleId && m.moduleId.toString() === moduleId
    );
    
    if (!moduleProgress) {
      return res.status(200).json({
        success: true,
        moduleProgress: {
          moduleId,
          moduleName: module.name,
          started: false,
          completed: false,
          progress: 0,
          days: []
        }
      });
    }
    
    // Process day progress
    const days = await Promise.all((module.days || []).map(async (day, index) => {
      const dayNumber = index + 1;
      const userDayProgress = moduleProgress.days.find(d => d.dayNumber === dayNumber);
      
      return {
        dayNumber,
        title: day.title || `Day ${dayNumber}`,
        started: userDayProgress ? userDayProgress.started : false,
        completed: userDayProgress ? userDayProgress.completed : false,
        exercises: userDayProgress ? userDayProgress.exercises.map(e => ({
          exerciseId: e.exerciseId,
          completed: e.completed,
          completedAt: e.completedAt
        })) : []
      };
    }));
    
    res.status(200).json({
      success: true,
      moduleProgress: {
        moduleId,
        moduleName: module.name,
        started: moduleProgress.started,
        startedAt: moduleProgress.startedAt,
        completed: moduleProgress.completed,
        completedAt: moduleProgress.completedAt,
        lastAccessedDay: moduleProgress.lastAccessedDay,
        progress: module.days && module.days.length > 0 
          ? Math.round((moduleProgress.days.filter(d => d.completed).length / module.days.length) * 100)
          : 0,
        days
      }
    });
  } catch (error) {
    console.error('Error getting module progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving module progress'
    });
  }
});

module.exports = router;
