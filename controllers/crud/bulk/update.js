const { authenticate } = require('../../../middlewares/authentication');
const { checkUniqueFields } = require('../../../utils/validateUniqueFields');
const { adminDB } = require('../../../database');
const { getSchemaValidator } = require('../../../utils/schemaValidator');
const resolveRelations = require('../../../utils/resolveRelations');

const bulkUpdate = (Model, modelName, uniqueFields = []) => {
  const schemaValidator = getSchemaValidator(modelName, adminDB);

  return [
    authenticate,
    schemaValidator,
    checkUniqueFields(uniqueFields, Model, modelName, true),
    async (req, res, next) => {
      try {
        const items = req.body.items;

        if (!Array.isArray(items) || items.length === 0) {
          return res.badRequest({ message: 'No items provided for update' });
        }

        const results = [];

        for (const itemData of items) {
          const itemId = itemData._id;
          if (!itemId) continue;

          const beforeDoc = await Model.findById(itemId);
          if (!beforeDoc) continue;

          const linkedObjects = Object.fromEntries(
            Object.entries(itemData).filter(([key]) => key.startsWith('linkedObject_'))
          );

          const linkedObjectIds = await resolveRelations(linkedObjects, Model);

          const updateData = {
            ...itemData,
            ...linkedObjectIds,
          };

          const updatedItem = await Model.findByIdAndUpdate(itemId, updateData, { new: true });

          results.push({
            before: beforeDoc,
            after: updatedItem
          });
        }

        // إعداد بيانات الـ audit بدون استدعاء auditTrail نفسه
        req.audit = results.map(entry => ({
          modelName,
          documentId: entry.after._id,
          before: entry.before,
          after: entry.after
        }));

        res.success({
          message: `${results.length} ${modelName}s updated successfully`,
          data: results.map(r => r.after.toJSON())
        });

        next(); // لازم next يوصل لـ auditTrail في initController
      } catch (error) {
        console.error(`Bulk update error in ${modelName}:`, error);
        res.internalServerError({
          message: `Error updating ${modelName}s`,
          error: error.message
        });
      }
    }
  ];
};

module.exports = bulkUpdate;
