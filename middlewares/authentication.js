const jwt = require('jsonwebtoken');
const { loadSchema } = require('../database');

const authenticate = async (req, res, next) => {
  try {
    const path = req.originalUrl.toLowerCase();
    const schemaMatch = path.match(/\/api\/v1\/([^\/\?\s]+)/);
    const schemaName = schemaMatch?.[1];

    const schema = await loadSchema(schemaName);

   if (schema?.auth?.allowAnonymousCreate && req.method === 'POST') {
  return next();
}
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.unauthorized({ msg: 'Authentication token is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.unauthorized({ msg: 'Unauthorized: Invalid token' });
  }
};

const checkRole = (roles) => (req, res, next) => {
  const userRoles = req.user?.roles || [];

  const hasRequiredRole = roles.some(role => new Set(userRoles).has(role));
  
  if (hasRequiredRole) {
    next();
  } else {
    console.log(`User does not have the required roles: ${roles}`);
    res.forbidden({ msg: 'Forbidden: Insufficient privileges.' });
  }
};

const authorizeOwnerOrRole = (Model, roles = []) => {
  return async (req, res, next) => {
    try {
      const item = await Model.findById(req.params._id);

      if (!item) {
        console.log(`Item not found: ${req.params._id}`);
        return res.notFound({ msg: 'Item not found' });
      }

      const itemOwnerId = item.owner ? item.owner.toString() : null;
      const userId = req.user?.id ? req.user.id.toString() : null;

      if (!itemOwnerId || !userId) {
        console.error('Authorization data is missing');
        return res.internalServerError({ msg: 'Authorization data is missing' });
      }

      const isOwner = itemOwnerId === userId;
      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];

      const validRoles = Array.isArray(roles) ? roles : [];

      const hasRole = validRoles.some(role => userRoles.includes(role));

      if (!isOwner && !hasRole) {
        console.log(`User is not authorized: User ID: ${userId}, Item Owner ID: ${itemOwnerId}`);
        return res.forbidden({ msg: 'Forbidden' });
      }

      req.actionMadeBy = isOwner ? 'owner' : hasRole ? 'role' : 'unknown';
      next();
    } catch (error) {
      console.error('Authorization Error:', error.message);
      res.internalServerError({ msg: 'Internal error during authorization.', error: error.message });
    }
  };
};


module.exports = { authenticate, checkRole, authorizeOwnerOrRole };