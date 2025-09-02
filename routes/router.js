const express = require('express');
const createCrudRoutes = require('./crud');
const { uploadSignedUrl } = require('../services/media/uploadSignedUrl');
const { uploadComplete } = require('../services/media/uploadComplete');
const { authenticate } = require('../middlewares/authentication');
const modelBuilder = require('../helpers/modelBuilder');
const normalizeCollectionName = require('../helpers/normalizeCollectionName');
const { processPayment } = require('../services/payment/processPayment');
const { loadAllCollections, loadAllSchemas, createCollection, dataDB , loadMetadata, loadSchema} = require('../database');
const initController = require('../controllers/crud/init');
const authHandler = require('../services/auth/action'); // أو حسب مسار `action.js`


const router = express.Router();

let registered = false;

const registerDynamicRoutes = async () => {
 if (registered) return;
  registered = true; 

  try {
    const schemas = await loadAllSchemas();

    for (const schema of schemas) {
      const { name, fields = [] } = schema;

      if (!name?.singular || !name?.plural) continue;

      const endpoint = normalizeCollectionName(name.singular); 
      const collection = normalizeCollectionName(name.plural);   
      const modelName = normalizeCollectionName(name.singular); 

   if (modelName === 'auth') {
        router.post(`/${endpoint}`, async (req, res) => {
          const doc = req.body;
          try {
            await authHandler(
              doc,
              () => {}, // dummy next
              {
                adminDB: require('../database').adminDB(),
                dataDB: require('../database').dataDB(),
                signToken: require('../utils/token').signToken,
                require
              }
            );

            const response = doc._response || { message: 'No response' };
            res.status(response.success === false ? 400 : 200).json(response);
          } catch (err) {
            console.error('❌ Error in /auth handler:', err);
            res.status(500).json({ message: 'Internal auth error', error: err.message });
          }
        });
        continue;
      }


      const exists = await loadAllCollections().then(collections => collections.includes(collection));

      if (!exists) {
        await createCollection(collection);
      }

      
      const model = await modelBuilder(schema, dataDB());
      const uniqueFields = fields.filter(f => f.unique).map(f => f.name);
      const controller = initController(model, modelName, uniqueFields);

      router.use(`/${endpoint}`, createCrudRoutes(controller)); 



    }

    registered = true;
  } catch (err) {
    console.error('❌ Failed to register dynamic routes:', err);
  }
};

registerDynamicRoutes();

  router.get('/metadata/:ui', async (req, res) => {
  try {
    const ui = req.params.ui;
    const metadata = await loadMetadata(ui);

    if (!metadata) {
      return res.notFound({ message:  `Metadata not found for UI: "${ui}"` });
    }

    res.json(metadata);
  } catch (err) {
    console.error('Error loading metadata:', err);
    res.internalServerError({ message: 'Failed to load metadata' });
  }
});

router.get('/view/:param1/:param2', async (req, res) => {
  const { param1, param2 } = req.params;
  const {
    collection: collectionFromQuery,
    type = 'list',
    limit = 100,
    skip = 0,
    sort,
    filter,
    pipeline
  } = req.query;

  try {
    let ui, collection;

    if (param2) {
      collection = normalizeCollectionName(param1);
      ui = param2;
    } else {
      ui = param1;
      if (!collectionFromQuery) {
        return res.badRequest({ message: 'Missing collection parameter' });
      }
      collection = normalizeCollectionName(collectionFromQuery);
    }

    const uiConfig = await loadMetadata(ui);
    if (!uiConfig) {
      return res.notFound({ message: `UI config not found for "${ui}"` });
    }

    const schemaDoc = await loadSchema(collection);
    if (!schemaDoc || !Array.isArray(schemaDoc.fields)) {
      return res.internalServerError({ message: `Schema not found or invalid for collection "${collection}"` });
    }

    const model = await modelBuilder(schemaDoc, dataDB(), collection);

    let data = [];
    let total = 0;

    if (type === 'aggregate') {
      const parsedPipeline = JSON.parse(pipeline || '[]');
      data = await model.aggregate(parsedPipeline);
      total = data.length; // في الحالة دي لازم المستخدم يتحكم بالحد
    } else {
      const parsedFilter = JSON.parse(filter || '{}');
      const parsedSort = sort ? JSON.parse(sort) : null;

      const baseQuery = model.find(parsedFilter);
      if (parsedSort) baseQuery.sort(parsedSort);

      // 🧠 حساب العدد الكلي قبل التقطيع
      total = await model.countDocuments(parsedFilter);

      // 🧠 تحديد الحد (limit)
      const limitNum = limit === 'all' ? total : Math.min(parseInt(limit), 1000); // حماية للسيرفر
      const skipNum = parseInt(skip);

      const paginatedQuery = baseQuery.skip(skipNum).limit(limitNum);
      data = await paginatedQuery;
    }

    res.json({
      metadata: uiConfig,
      data,
      pagination: {
        total,
        limit: limit === 'all' ? total : parseInt(limit),
        skip: parseInt(skip),
        currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
        totalPages: limit === 'all' ? 1 : Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('❌ Error in unified /view endpoint:', err);
    res.internalServerError({ message: 'Failed to fetch data or schema' });
  }
});

router.post('/process-payment', authenticate, processPayment);
router.post('/upload-signed-url', authenticate, uploadSignedUrl);
router.post('/upload-complete', authenticate, uploadComplete);



module.exports = router;

