const { loadSchema } = require('../../../database');
const resolveRelationsWithSchema = require('../../../utils/resolveRelations');
// const { getSchemaValidator } = require('../../../utils/schemaValidator'); ← إذا أردت تفعيل الفاليديشن لاحقًا
// const { authenticate } = require('../../../middlewares/authentication');
// const { checkUniqueFields } = require('../../../utils/validateUniqueFields');

const singleUpdate = (Model, modelName, uniqueFields = []) => {
  return [
    // authenticate, ← تفعيل لاحقًا حسب الحاجة
    // getSchemaValidator(modelName),
    // checkUniqueFields(uniqueFields, Model, modelName, true),

    async (req, res, next) => {
      try {
        const itemId = req.params.id;

        const beforeDoc = await Model.findById(itemId);
        if (!beforeDoc) {
          return res.notFound({ message: `${modelName} not found` });
        }

        // 🔍 تحميل السكيما للتحقق أو استخراج العلاقات
        const schema = await loadSchema(modelName, true);
        if (!schema || !Array.isArray(schema.fields)) {
          throw new Error(`Schema definition invalid or missing fields for "${modelName}"`);
        }

        // 🔁 فك العلاقات إن وجدت
        const parsedData = await resolveRelationsWithSchema(req.body, schema.fields);

        // 🛠️ تنفيذ التحديث
        const updatedItem = await Model.findByIdAndUpdate(itemId, parsedData, { new: true });

        // 🧾 سجل التغيير
        req.audit = {
          modelName,
          documentId: updatedItem._id,
          action: 'update',
          before: beforeDoc,
          after: updatedItem
        };

        // ✅ رد النجاح
        res.success({
          message: `${modelName} updated successfully`,
          data: updatedItem.toJSON()
        });

        next(); // لتمرير التحكم إلى auditTrail
      } catch (error) {
        console.error(`🔥 Error updating [${modelName}]:`, error.message);
        res.internalServerError({
          message: `Error updating ${modelName}`,
          error: error.message
        });
      }
    }
  ];
};

module.exports = singleUpdate;
  