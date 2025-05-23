// middleware/betaContentRestriction.js
/**
 * Middleware to restrict beta content based on user role and module
 * For example, beta users can only see Day 1 of the Shell module
 */
const betaContentRestriction = (req, res, next) => {
  try {
    const { moduleSlug } = req.params;
    const { dayNumber } = req.params;
    
    // If not a beta user or admin, proceed normally
    if (!req.user || (req.user.role !== 'beta' && req.user.role !== 'admin')) {
      return next();
    }
    
    // For beta users accessing Shell module
    if (moduleSlug === 'shell' && req.user.role === 'beta') {
      // Allow access only to day 1
      if (dayNumber && parseInt(dayNumber) > 1) {
        return res.status(403).json({
          success: false,
          message: 'Beta users can only access Day 1 of the Shell module'
        });
      }
      
      // If listing all days, middleware will pass but the route handler 
      // should filter content (see moduleRoutes.js)
    }
    
    next();
  } catch (error) {
    console.error('Beta content restriction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing beta content restriction'
    });
  }
};

module.exports = { betaContentRestriction };
