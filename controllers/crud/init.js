const singleCreate = require('./single/create');
const bulkCreate = require('./bulk/create');
const singleRead = require('./single/read');
const bulkRead = require('./bulk/read');
const singleUpdate = require('./single/update');
const bulkUpdate = require('./bulk/update');
const singleDelete = require('./single/delete');
const bulkDelete = require('./bulk/delete');

const { checkUniqueFields } = require('./../../utils/validateUniqueFields');
const { getSchemaValidator } = require('./../../utils/schemaValidator');
const auditTrail = require('../../middlewares/audit');
const { adminDB } = require('../../database');

const initController = (Model, modelName) => {
  // const validator = getSchemaValidator(modelName, adminDB);
const wrapWithAudit = (middlewares, { skip = false } = {}) =>
  skip ? middlewares : [...middlewares, auditTrail()];

  return {
    createItem: wrapWithAudit([
      // validator,
      checkUniqueFields(Model, modelName),
      singleCreate(Model, modelName)
    ]),

    createManyItems: wrapWithAudit([
      // validator,
      checkUniqueFields(Model, modelName),
      bulkCreate(Model, modelName)
    ]),

    getItems: bulkRead(Model, modelName),
    getItem: singleRead.readItem(Model, modelName),
    getItemBySlug: singleRead.readItemBySlug(Model, modelName),
    getItemByField: singleRead.readItemByField(Model, modelName),
    getFieldById: singleRead.readFieldById(Model, modelName),
    getMyItems: singleRead.readMyItems(Model, modelName),

    updateItem: wrapWithAudit([
      // validator,
      checkUniqueFields(Model, modelName, true),
      singleUpdate(Model, modelName)
    ]),

    updateManyItems: wrapWithAudit([
      // validator,
      checkUniqueFields(Model, modelName, true),
      bulkUpdate(Model, modelName)
    ]),

    deleteItem: wrapWithAudit(singleDelete.hardDelete(Model, modelName)),
    softDeleteItem: wrapWithAudit(singleDelete.softDelete(Model, modelName)),
    restoreItem: wrapWithAudit(singleDelete.restore(Model, modelName)),

    deleteManyItems: wrapWithAudit(bulkDelete.hardDeleteMany(Model, modelName)),
    softDeleteManyItems: wrapWithAudit(bulkDelete.softDeleteMany(Model, modelName)),
    restoreManyItems: wrapWithAudit(bulkDelete.restoreMany(Model, modelName))
  };
};

module.exports = initController;
