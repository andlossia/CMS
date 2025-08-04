const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middlewares/authentication');

const createCrudRoutes = (controller) => {
  const router = express.Router();

  // 📥 READ ROUTES
  router.get('/', controller.getItems);
  router.get('/me',controller.getMyItems);
  router.get('/slug/:slug', controller.getItemBySlug);
  router.get('/:_id', controller.getItem);
  router.get('/:key/:value', async (req, res, next) => {
    const { key } = req.params;

    if (mongoose.Types.ObjectId.isValid(key)) {
      req.params._id = key;
      req.params.field = req.params.value;
      return controller.getFieldById(req, res, next);
    } else if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
      req.params._id = req.params.slug;
      return controller.getItem(req, res, next);
    }

    return controller.getItemByField(req, res, next);
  });

  // 🟩 CREATE ROUTES
  router.post('/', controller.createItem);
  router.post('/bulk', controller.createManyItems);

  // 🟨 UPDATE ROUTES
  router.put('/:id', controller.updateItem);
  router.put('/bulk', controller.updateManyItems);
  router.patch('/:_id', controller.updateItem);
  router.patch('/bulk', controller.updateManyItems);

  // 🟥 DELETE ROUTES
  router.delete('/:id', controller.deleteItem);
  router.delete('/:id/soft', controller.softDeleteItem);
  router.patch('/:id/restore', controller.restoreItem);
  router.delete('/bulk', controller.deleteManyItems);
  router.delete('/bulk/soft', controller.softDeleteManyItems);
  router.patch('/bulk/restore', controller.restoreManyItems);

  

  return router;
};

module.exports = createCrudRoutes;
