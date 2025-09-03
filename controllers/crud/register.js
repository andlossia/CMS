const initController = require('./init');
const modelBuilder = require('../../helpers/modelBuilder');
const normalizeCollectionName = require('../../helpers/normalizeCollectionName');
const SchemaModel = require('../../models/schema');

const registerCollections = async (dataDB, onlyList = [], collections = {}) => {
  const collectionInfos = await dataDB.listCollections().toArray();

  for (const info of collectionInfos) {
    const rawName = info.name;
    const normalizedName = normalizeCollectionName(rawName); 

    if (onlyList.length && !onlyList.includes(normalizedName)) continue;

    const schemaDoc = await SchemaModel.findOne({
      $or: [
        { collectionName: normalizedName },
        { 'name.collection': rawName },
        { 'name.collection': { $regex: new RegExp('^' + rawName + '$', 'i') } }
      ]
    });

    if (!schemaDoc) continue;

    const model = modelBuilder(schemaDoc);
    const actualCollectionName = model.collection.name;
    const collection = dataDB.collection(actualCollectionName);
    const indexes = await collection.indexes();
    const uniqueFields = indexes
      .filter(index => index.unique)
      .flatMap(index => Object.keys(index.key));

    collections[actualCollectionName] = {
      model,
      controller: initController(model, actualCollectionName, uniqueFields),
    };
  }

  return collections;
};

module.exports = registerCollections;
