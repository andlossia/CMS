const checkUniqueFields = (uniqueFields = [], Model, modelName = 'resource', isUpdate = false) => {
  if (!Array.isArray(uniqueFields)) {
    uniqueFields = [];
  }

  return async (req, res, next) => {
    try {
      for (const field of uniqueFields) {
        const value = field.split('.').reduce((acc, key) => acc?.[key], req.body);
        if (value !== undefined && value !== null) {
          const query = { [field]: value };

          if (isUpdate && req.params._id) {
            query._id = { $ne: req.params._id };
          }

          const existingItem = await Model.findOne(query);
          if (existingItem) {
            return res.badRequest({
              message: `${modelName} with this ${field} already exists`,
              conflictId: existingItem._id
            });
          }
        }
      }

      next();
    } catch (error) {
      res.internalServerError({
        message: `Failed to check unique fields for ${modelName}`,
        error: `${error.message}. uniqueFields: ${JSON.stringify(uniqueFields)}`
      });
    }
  };
};

module.exports = { checkUniqueFields };
