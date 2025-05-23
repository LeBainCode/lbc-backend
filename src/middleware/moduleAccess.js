// middleware/moduleAccess.js
/**
 * Middleware to verify user can access a specific module
 * @param {Boolean} requiresCompletion - Whether the module requires completion of prerequisites
 * @returns {Function} Express middleware function
 */
const checkModuleAccess = (requiresCompletion = true) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      
      const moduleId = req.params.moduleId || req.params.id || req.body.moduleId;
      
      if (!moduleId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Module ID is required' 
        });
      }
      
      // Allow admin users to access any module
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Load module data
      const Module = require('../models/Module');
      const module = await Module.findById(moduleId);
      
      if (!module) {
        return res.status(404).json({
          success: false,
          message: 'Module not found'
        });
      }
      
      // Check module access based on rules
      
      // 1. GitHub module (free for all users)
      if (module.slug === 'github') {
        return next();
      }
      
      // 2. Paid module check
      if (module.isPaid && !req.user.payment?.hasPaidAccess) {
        return res.status(403).json({
          success: false,
          message: 'This module requires payment',
          requiresPayment: true
        });
      }
      
      // 3. Beta-only modules (Shell module for beta testers)
      if (module.slug === 'shell' && req.user.role === 'beta') {
        // Beta users can access shell module (with limitations handled in the route)
        // Make sure they've passed the GitHub test with 60%+
        if (requiresCompletion) {
          // Get GitHub module
          const githubModule = await Module.findOne({ slug: 'github' });
          
          if (!githubModule) {
            return res.status(500).json({
              success: false,
              message: 'Error checking prerequisites'
            });
          }
          
          // Check if user has passed GitHub test
          const githubTestPassed = req.user.progress?.testScores?.some(score => 
            score.moduleId.toString() === githubModule._id.toString() && 
            score.score >= 60
          );
          
          if (!githubTestPassed) {
            return res.status(403).json({
              success: false,
              message: 'You must complete the GitHub module test with a score of at least 60% first'
            });
          }
        }
        
        return next();
      }
      
      // 4. Prerequisite check for regular progression
      if (module.prerequisiteModule && requiresCompletion) {
        const prerequisitePassed = req.user.progress?.testScores?.some(score => 
          score.moduleId.toString() === module.prerequisiteModule.toString() && 
          score.score >= module.prerequisiteScore
        );
        
        if (!prerequisitePassed) {
          return res.status(403).json({
            success: false,
            message: `You must complete the prerequisite module test with a score of at least ${module.prerequisiteScore}% first`
          });
        }
      }
      
      // If we've passed all checks, grant access
      next();
    } catch (error) {
      console.error('Module access error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking module access'
      });
    }
  };
};

module.exports = { checkModuleAccess };
