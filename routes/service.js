const express = require('express');
const serviceController = require('../controllers/service');
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

    router.get('/', serviceController.getAllServices);
    router.get('/:name', serviceController.getService);
    router.post('/', serviceController.createService);
    router.put('/:name', serviceController.updateService);
    router.delete('/:name', serviceController.deleteService);

  } catch (err) {
    console.error('Error initializing adminDB (Service Router):', err);
  }
})();

module.exports = router;
