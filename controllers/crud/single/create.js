const { authenticate } = require('../../../middlewares/authentication');
const { getSchemaValidator } = require('../../../utils/schemaValidator');
const { checkUniqueFields } = require('../../../utils/validateUniqueFields');
const { loadSchema } = require('../../../database');
const resolveRelationsWithSchema = require('../../../utils/resolveRelations');


const singleCreate = (Model, modelName, uniqueFields = []) => {
  const schemaValidator = getSchemaValidator(modelName);

  return [
    authenticate,
    schemaValidator,
    checkUniqueFields(uniqueFields, Model, modelName),
    async (req, res, next) => {
      try {
        const schema = await loadSchema(modelName, true);
        if (!schema || !Array.isArray(schema.fields)) {
          throw new Error(`Schema definition invalid or missing fields for "${modelName}"`);
        }

        const parsedData = await resolveRelationsWithSchema(req.body, schema.fields);
        const item = await Model.create(parsedData);
        req.audit = {
          modelName,
          documentId: item._id,
          action: 'create',
          after: item
        };

        res.created({
          message: `${modelName} created successfully`,
          data: item.toJSON()
        });

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
