const { authenticate } = require('../../../middlewares/authentication');
const {checkUniqueFields} = require('../../../utils/validateUniqueFields');
const {getSchemaValidator} = require('../../../utils/schemaValidator');
const { adminDB } = require('../../../database');
const resolveRelations = require('../../../utils/resolveRelations');

 const createManyItems = (Model, modelName, uniqueFields = []) => {
  const schemaValidator = getSchemaValidator(modelName, adminDB);

  return [
    authenticate,
    schemaValidator,
    checkUniqueFields(uniqueFields, Model, modelName),
    async (req, res) => {
      const owner = req.user ? req.user.id : null;

      try {
        const items = [];

        for (const itemData of req.body.items) {
          const linkedObjects = {};

          for (const [key, value] of Object.entries(itemData)) {
            if (key.startsWith('linkedObject_')) {
              linkedObjects[key] = value;
            }
          }

          const linkedObjectIds = await resolveRelations(linkedObjects, Model);
          const finalItemData = { ...itemData, ...linkedObjectIds, owner };

    

          const item = await Model.create(finalItemData);
          items.push(item);
        }

        res.created({
          message: `${modelName}s created successfully`,
          data: items.map((item) => item.toJSON()),
        });
      } catch (error) {
        res.internalServerError({
          message: `Error creating ${modelName}s`,
          error: error.message,
        });
      }
    }
  ];
};

  
  module.exports = createManyItems;
  