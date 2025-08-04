const express = require('express');
const schemaController = require('../controllers/schema');
const { adminDB } = require('../database');
const router = express.Router();

(async () => {
  try {
    let retries = 20;
    while (!adminDB() && retries > 0) {
      await new Promise(res => setTimeout(res, 100));
      retries--;
    }

    if (!adminDB()) {
      throw new Error('adminDB is not initialized. Make sure connectToDatabase() was called first.');
    }

  

    router.get('/', schemaController.getAllSchemas);
    router.get('/:name/branch', schemaController.getSchemaBranch);
    router.get('/:name', schemaController.getSchema);
    router.put('/:name', schemaController.updateSchema);
    router.delete('/:name', schemaController.deleteSchema);

  } catch (err) {
    console.error('Error initializing adminDB:', err);
  }
})();

module.exports = router;
