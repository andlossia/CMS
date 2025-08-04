const defaultSensitiveFields = ['password', 'token', '__v', 'resetToken', 'resetTokenExpiry'];

function filterFields(data, fieldsToFilter = defaultSensitiveFields, seen = new WeakSet()) {
  if (Array.isArray(data)) {
    return data.map(item => filterFields(item, fieldsToFilter, seen));
  }

  if (typeof data === 'object' && data !== null) {
    if (seen.has(data)) return undefined;
    seen.add(data);

    const filtered = {};
    for (const key in data) {
      if (!fieldsToFilter.includes(key)) {
        filtered[key] = filterFields(data[key], fieldsToFilter, seen);
      }
    }
    return filtered;
  }

  return data;
}

function filterSensitiveFieldsMiddleware(options = {}) {
  const {
    excludePaths = [],
    extraFields = [],
  } = options;

  const fieldsToFilter = [...new Set([...defaultSensitiveFields, ...extraFields])];

  return function (req, res, next) {
    const originalJson = res.json;

    res.json = function (data) {
      const currentPath = req.originalUrl.split('?')[0];

      if (excludePaths.includes(currentPath)) {
        return originalJson.call(this, data);
      }

      try {
        const filteredData = filterFields(data, fieldsToFilter);
        return originalJson.call(this, filteredData);
      } catch (err) {
        console.error('❌ Error filtering sensitive fields:', err);
        return originalJson.call(this, data); 
      }
    };

    next();
  };
}

module.exports = filterSensitiveFieldsMiddleware;
