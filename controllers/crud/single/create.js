const { authenticate } = require('../../../middlewares/authentication');
const { getSchemaValidator } = require('../../../utils/schemaValidator');
const { checkUniqueFields } = require('../../../utils/validateUniqueFields');
const { loadSchema } = require('../../../database');
const resolveRelationsWithSchema = require('../../../utils/resolveRelations');


const singleCreate = (Model, modelName, uniqueFields = []) => {
  // const schemaValidator = getSchemaValidator(modelName);

  return [
    // 🔐 طبقة المصادقة (مفعّلة لاحقًا عند الحاجة)
    // authenticate,

    // ✅ تحقق من صحة البنية والقيم بناءً على سكيما adminDB
    // schemaValidator,

    // 🔄 تحقق من تكرار الحقول الفريدة
    checkUniqueFields(uniqueFields, Model, modelName),

    // 🧠 المعالج الرئيسي
    async (req, res, next) => {
      try {
        // 1️⃣ تحميل تعريف السكيما من adminDB
        const schema = await loadSchema(modelName, true); // ← forceRefresh
        if (!schema || !Array.isArray(schema.fields)) {
          throw new Error(`Schema definition invalid or missing fields for "${modelName}"`);
        }

        // 2️⃣ فك العلاقات والحقول المتداخلة ديناميكيًا
        // const parsedData = await resolveRelationsWithSchema(req.body, schema.fields);

        // 3️⃣ إنشاء المستند في قاعدة بيانات dataDB
        const item = await Model.create(req.body);

        // 4️⃣ تسجيل العملية في سجل التدقيق
        req.audit = {
          modelName,
          documentId: item._id,
          action: 'create',
          after: item
        };

        // 5️⃣ إرسال الاستجابة النهائية
        res.created({
          message: `${modelName} created successfully`,
          data: item.toJSON()
        });

        // 📝 تمرير الطلب إلى الميدلوير التالي (auditTrail)
        next();
      } catch (error) {
        console.error(`🔥 Error creating [${modelName}]:`, error.message);
        res.internalServerError({
          message: `Error creating ${modelName}`,
          error: error.message
        });
      }
    }
  ];
};

module.exports = singleCreate;
