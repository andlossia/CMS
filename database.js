const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

/** ------------------------------
 *  Logger بسيط لتوحيد الإخراج
 * ------------------------------ */
const logger = {
  info: (msg, ...args) => console.log(`ℹ️ ${msg}`, ...args),
  success: (msg, ...args) => console.log(`✅ ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`⚠️ ${msg}`, ...args),
  error: (msg, ...args) => console.error(`💥 ${msg}`, ...args),
};

let mongoClient;
let adminDB, dataDB;
let isDBInitialized = false;
let supportsChangeStreams = false;

/** ------------------------------
 *  Schemas Operations
 * ------------------------------ */

async function loadAllSchemas() {
  return await adminDB.collection('schemas').find({}).toArray();
}


async function loadSchema(endpoint) {
  return await adminDB.collection('schemas').findOne({ 'name.endpoint': endpoint });
}


async function loadMetadata(ui) {
  return await adminDB.collection('metadata').findOne({ ui });
}


async function createSchema(schema) {
  const result = await adminDB.collection('schemas').insertOne(schema);
  await loadAllSchemas(true); 
  return result.insertedId.toString();
}

/** ------------------------------
 *  Collections Operations
 * ------------------------------ */


async function loadAllCollections() {
  const collections = await dataDB.listCollections().toArray();
  return collections.map((collection) => collection.name);
}

async function loadCollection(collectionName) {
  return dataDB.collection(collectionName);
}


async function createCollection(collectionName) {
  await dataDB.createCollection(collectionName);
}

/** ------------------------------
 *  Utils
 * ------------------------------ */


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
    logger.success('Change Streams are supported by your MongoDB cluster.');
    return true;
  } catch (err) {
    logger.warn('Change Streams are NOT supported on this cluster.');
    logger.error('Reason:', err.message || err);
    return false;
  }
}

/** ------------------------------
 *  Database Connection
 * ------------------------------ */


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

    logger.success(`${process.env.PROJECT_NAME} Database connected successfully`);
    isDBInitialized = true;
    supportsChangeStreams = await checkChangeStreamSupport();

    return { adminDB, dataDB };
  } catch (err) {
    logger.error('MongoDB connection error:', err);
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
    logger.info('MongoClient connection closed');
  }
  await mongoose.disconnect();
  logger.info('Mongoose connection closed');
};

/** ------------------------------
 *  Exports
 * ------------------------------ */
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
