const { authenticate, authorizeOwnerOrRole } = require('../../../middlewares/authentication');
const { deleteFromStorage } = require('../../../services/media/deleteFile');

const singleDelete = {
  softDelete: (Model, modelName) => [
    authenticate,
    authorizeOwnerOrRole(Model, modelName),
    async (req, res, next) => {
      try {
        const beforeDoc = await Model.findById(req.params.id);
        if (!beforeDoc) {
          return res.notFound({ message: `${modelName} not found` });
        }

        const updatedDoc = await Model.findByIdAndUpdate(
          req.params.id,
          { isDeleted: true, deletedAt: new Date() },
          { new: true }
        );

        req.audit = {
          modelName,
          documentId: updatedDoc._id,
          action: 'softDelete',
          before: beforeDoc.toObject(),
          after: updatedDoc.toObject()
        };

        res.success({ message: `${modelName} soft deleted successfully` });
        next();
      } catch (error) {
        res.internalServerError({
          message: `Error soft deleting ${modelName}`,
          error: error.message
        });
      }
    }
  ],

hardDelete: (Model, modelName) => [
  async (req, res, next) => {
    try {
      const id = req.params._id || req.params.id;
      const beforeDoc = await Model.findById(id);

      if (!beforeDoc) {
        return res.notFound({ message: `${modelName} not found` });
      }

      const before = beforeDoc.toObject?.() || beforeDoc;

      const actor =
        req.user?.id ||
        req.user?._id ||
        req.anonymousId ||
        before?.anonymous_id || 
        'unknown';

      console.log(`🧨 Deleting ${modelName} by ${actor}`);

      if (before?.storage) {
        const safeName = before.storage.path;
        const source = before.storage.source;

        if (safeName && source) {
          try {
            await deleteFromStorage(safeName, source);
            console.log(`🗑️ Successfully deleted from ${source}: ${safeName}`);
          } catch (err) {
            console.error(`❌ Failed to delete file during ${modelName} deletion:`, err.message);
          }
        } else {
          console.warn(`⚠️ Skipping storage deletion for ${modelName}: missing path or source`);
        }
      }

      await Model.findByIdAndDelete(id);

      req.audit = {
        modelName,
        documentId: id,
        action: 'hardDelete',
        actor,
        before
      };

      res.success({ message: `${modelName} permanently deleted` });
      next();
    } catch (error) {
      console.error(`🔥 Error in hardDelete(${modelName}):`, error);
      res.internalServerError({
        message: `Error hard deleting ${modelName}`,
        error: error.message
      });
    }
  }
],

  restore: (Model, modelName) => [
    authenticate,
    authorizeOwnerOrRole(Model, modelName),
    async (req, res, next) => {
      try {
        const beforeDoc = await Model.findById(req.params.id);
        if (!beforeDoc || !beforeDoc.isDeleted) {
          return res.notFound({ message: `${modelName} not found or not deleted` });
        }

        const restoredDoc = await Model.findByIdAndUpdate(
          req.params.id,
          { isDeleted: false, deletedAt: null },
          { new: true }
        );

        req.audit = {
          modelName,
          documentId: restoredDoc._id,
          action: 'restore',
          before: beforeDoc.toObject(),
          after: restoredDoc.toObject()
        };

        res.success({
          message: `${modelName} restored successfully`,
          data: restoredDoc
        });
        next();
      } catch (error) {
        res.internalServerError({
          message: `Error restoring ${modelName}`,
          error: error.message
        });
      }
    }
  ],


};

module.exports = singleDelete;
