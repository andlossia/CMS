const { authenticate, authorizeOwnerOrRole } = require('../../../middlewares/authentication');
const { deleteFromStorage } = require('../../../services/media/deleteFile');

const safeToObject = (doc) => doc?.toObject?.() || doc;

const bulkDelete = {
  softDeleteMany: (Model, modelName) => [
    authenticate,
    authorizeOwnerOrRole(Model, modelName),
    async (req, res, next) => {
      try {
        const ids = req.body.ids;
        const now = new Date();
        const beforeDocs = await Model.find({ _id: { $in: ids } });

        const result = await Model.updateMany(
          { _id: { $in: ids } },
          { isDeleted: true, deletedAt: now }
        );

        req.audit = {
          bulk: beforeDocs.map(doc => ({
            modelName,
            documentId: doc._id,
            action: 'softDelete',
            before: safeToObject(doc),
            after: { ...safeToObject(doc), isDeleted: true, deletedAt: now }
          }))
        };

        res.success({
          message: `${result.modifiedCount} ${modelName}s soft deleted successfully`
        });
        next();
      } catch (error) {
        res.internalServerError({
          message: `Error soft deleting ${modelName}s`,
          error: error.message
        });
      }
    }
  ],

  hardDeleteMany: (Model, modelName) => [
    async (req, res, next) => {
      try {
        const ids = req.body.ids || [];
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.badRequest({ message: 'Missing or invalid "ids" array in request body' });
        }

        const beforeDocs = await Model.find({ _id: { $in: ids } });
        if (!beforeDocs.length) {
          return res.notFound({ message: `No ${modelName} documents found to delete` });
        }

        console.log(`🧨 Bulk deleting ${beforeDocs.length} ${modelName}(s)`);

        const deleteOps = beforeDocs.map(doc => {
          const before = safeToObject(doc);
          const safeName = before?.storage?.path;
          const source = before?.storage?.source;

          if (safeName && source) {
            console.log(`🧪 Storage path: ${safeName} | Source: ${source}`);
            return deleteFromStorage(safeName, source)
              .then(() => console.log(`🗑️ Successfully deleted from ${source}: ${safeName}`))
              .catch(err => console.error(`❌ Failed to delete ${safeName} from ${source}:`, err.message));
          } else {
            console.warn(`⚠️ Skipping storage deletion for ${modelName} ${doc._id}: missing path or source`);
            return Promise.resolve();
          }
        });

        await Promise.allSettled(deleteOps);

        const result = await Model.deleteMany({ _id: { $in: ids } });

        req.audit = {
          bulk: beforeDocs.map(doc => ({
            modelName,
            documentId: doc._id,
            action: 'hardDelete',
            before: safeToObject(doc)
          }))
        };

        res.success({
          message: `${result.deletedCount} ${modelName}(s) permanently deleted`
        });
        next();
      } catch (error) {
        console.error(`🔥 Error in hardDeleteMany(${modelName}):`, error);
        res.internalServerError({
          message: `Error hard deleting ${modelName}(s)`,
          error: error.message
        });
      }
    }
  ],

  restoreMany: (Model, modelName) => [
    authenticate,
    authorizeOwnerOrRole(Model, modelName),
    async (req, res, next) => {
      try {
        const ids = req.body.ids;
        const beforeDocs = await Model.find({ _id: { $in: ids }, isDeleted: true });

        const result = await Model.updateMany(
          { _id: { $in: ids }, isDeleted: true },
          { isDeleted: false, deletedAt: null }
        );

        req.audit = {
          bulk: beforeDocs.map(doc => ({
            modelName,
            documentId: doc._id,
            action: 'restore',
            before: safeToObject(doc),
            after: { ...safeToObject(doc), isDeleted: false, deletedAt: null }
          }))
        };

        res.success({
          message: `${result.modifiedCount} ${modelName}s restored successfully`
        });
        next();
      } catch (error) {
        res.internalServerError({
          message: `Error restoring ${modelName}s`,
          error: error.message
        });
      }
    }
  ],
  

};

module.exports = bulkDelete;
