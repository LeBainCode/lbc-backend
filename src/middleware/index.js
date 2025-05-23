// middleware/index.js
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const { checkRole } = require('./checkRoleAccess');
const { checkModuleAccess } = require('./moduleAccess');
const { betaContentRestriction } = require('./betaContentRestriction');
const verifyToken = require('./verifyToken');

// Convenience middleware combinations
const checkAdmin = [verifyToken, checkRole('admin')];
const checkBetaAccess = [verifyToken, checkRole('beta', 'admin')];
const checkModuleAuthorization = [verifyToken, checkModuleAccess()];

module.exports = {
  verifyToken,
  checkRole,
  checkAdmin,
  checkBetaAccess,
  checkModuleAccess,
  checkModuleAuthorization,
  betaContentRestriction
};
