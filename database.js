const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

let mongoClient;
let adminDB, dataDB;
let isDBInitialized = false;
let supportsChangeStreams = false;

async function loadAllSchemas() {
  const schemas = await adminDB.collection('schemas').find({}).toArray();
  return schemas;
}


async function loadSchema(endpoint) {
  const schema = await adminDB.collection('schemas').findOne({ 'name.singular': endpoint });
  return schema;
}

async function loadMetadata(ui) {
  const metadata = await adminDB.collection('metadata').findOne({ ui });
  return metadata;
}


async function createSchema(schema) {
  const result = await adminDB.collection('schemas').insertOne(schema);
  await loadAllSchemas(true); 
  return result.insertedId.toString();
}


async function loadAllCollections() {
  const collections = await dataDB.listCollections().toArray();
  return collections.map((collection) => collection.name);
}

async function loadCollection(collectionName) {
  const collection = await dataDB.collection(collectionName);
  return collection;
}

async function createCollection(collectionName) {
  await dataDB.createCollection(collectionName);
}

async function checkChangeStreamSupport() {
  try {
    const testWatch = mongoClient.watch([], { maxAwaitTimeMS: 100 });
    const cursorPromise = testWatch.hasNext().catch(() => false);

    await Promise.race([
      cursorPromise,
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);

    await testWatch.close();
    supportsChangeStreams = true;
    console.log('✅ Change Streams are supported by your MongoDB cluster.');
    return true;
  } catch (err) {
    console.warn('⚠️ Change Streams are NOT supported on this cluster.');
    console.error('💥 Reason:', err.message || err);
    return false;
  }
}

const connectToDatabase = async () => {
  try {
    mongoClient = new MongoClient(process.env.DB_URI);
    await mongoClient.connect();

    adminDB = mongoClient.db('adminDB');
    dataDB = mongoClient.db('dataDB');

    for (const db of [adminDB, dataDB]) {
      await db.command({ ping: 1 });
    }

    await mongoose.connect(process.env.DB_URI, {
      dbName: 'dataDB',
    });

    mongoose.set('strictPopulate', false);


    console.log(`${process.env.PROJECT_NAME} Database connected successfully`);
    isDBInitialized = true;
    supportsChangeStreams = await checkChangeStreamSupport();

    return { adminDB, dataDB };
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

const getDataDBCollection = (collectionName) => {
  if (!dataDB) throw new Error('dataDB is not initialized');
  return dataDB.collection(collectionName);

};

const closeConnections = async () => {
  if (mongoClient) {
    await mongoClient.close();
    console.log('MongoClient connection closed');
  }
  await mongoose.disconnect();
  console.log('Mongoose connection closed');
};

module.exports = {
  connectToDatabase,
  loadAllCollections,
  createCollection,
  createSchema,
  loadCollection,
  isDBInitialized,
  getDataDBCollection,
  closeConnections,
  adminDB: () => adminDB,
  dataDB: () => dataDB,
  loadSchema,
  loadMetadata,
  supportsChangeStreams: () => supportsChangeStreams,
  loadAllSchemas
};
