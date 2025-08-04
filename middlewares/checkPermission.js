const Permission = require('../models/permission');

const checkPermission = (action, modelName, isBulk = false) => {
  return async (req, res, next) => {
    try {
      const user = req.user || null;
      const isAuthenticated = !!user;
      const userRoles = isAuthenticated
        ? (Array.isArray(user.roles) ? user.roles : [user.role])
        : ['guest'];

      const targetUserId = req.params.userId || req.body.userId || req.query.userId;
      const isSelf = user && targetUserId && user._id.toString() === targetUserId.toString();
      const actionType = isBulk ? 'bulk' : 'single';

      // Get permissions for model
      const permissionDoc = await Permission.findOne({ schemaName: modelName });
      if (!permissionDoc) {
        return res.forbidden(`No permissions found for model: ${modelName}`);
      }

      let allowed = false;

      for (const roleId of userRoles) {
        const roleEntry = permissionDoc.roles.find(r => r.role.toString() === roleId.toString());
        if (!roleEntry) continue;

        const access = roleEntry.access?.[action]?.[actionType];
        if (!access) continue;

        // anonymous
        if (!isAuthenticated && access.allowAnonymous) {
          allowed = true;
          break;
        }

        // authenticated
        if (isAuthenticated) {
          if (isSelf && access.self) {
            allowed = true;
            break;
          }
          if (!isSelf && access.other) {
            allowed = true;
            break;
          }
        }
      }

      if (!allowed) {
        return res.forbidden(
          `Permission denied for action '${action}' (${actionType}) on model '${modelName}'`
        );
      }

      return next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.internalServerError('An error occurred while checking permissions', error.message);
    }
  };
};

module.exports = checkPermission;