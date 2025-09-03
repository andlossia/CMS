const singleRead = {
  readItem: (Model, modelName) => async (req, res) => {
    try {
    const id = req.params._id;
    const item = await Model.findOne({ _id: id }); 
      if (!item) {
        return res.notFound({ message: `${modelName} not found` });
      }
      res.success(item);
    } catch (error) {
      res.internalServerError({
        message: `Error fetching ${modelName}`,
        error: error.message,
      })
    }
  },

readMyItems: (Model, modelName) => async (req, res) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.unauthorized({ msg: 'User not authenticated' });
    }

    const userField = Model.userField || 'userId'; 
    const items = await Model.find({ [userField]: currentUserId });
 

    res.success(items);
  } catch (error) {
    res.internalServerError({
      message: `Error fetching ${modelName}`,
      error: error.message,
    });
  }
},

  readItemBySlug: (Model, modelName) => async (req, res) => {
  try {
    const item = await Model.findOne({ slug: req.params.slug })  
      .lean();

    if (!item) {
      return res.notFound({ message: `${modelName} not found` });
    }
    res.success(item);
  } catch (error) {
    res.internalServerError({
      message: `Error fetching ${modelName}`,
      error: error.message,
    });
  }
}
,

  readItemByField: (Model, modelName, allowedKeys = []) => async (req, res) => {
    const { key, value } = req.params;
    const { single, sort, limit } = req.query;
  
    if (allowedKeys.length > 0 && !allowedKeys.includes(key)) {
      return res.badRequest({
        message: `Invalid field '${key}'. Allowed fields: ${allowedKeys.join(', ')}`,
      });
    }
  
    try {
      let items;
  
      if (sort === 'rand') {
        const pipeline = [
          { $match: { [key]: value } },
          { $sample: { size: Number(limit) || 1 } },
        ];
        items = await Model.aggregate(pipeline);
      } else {
        let query = Model.find({ [key]: value });
  
        if (sort) {
          query = query.sort(sort);
        }
  
        if (limit) {
          query = query.limit(Number(limit));
        }
  
        if (single) {
          query = query.limit(1);
        }
  
        items = await query.exec();
      }
  
      if (!items || items.length === 0) {
        return res.notFound({ message: `${modelName} not found` });
      }
  
      res.success(single ? items[0] : items);
    } catch (error) {
      res.internalServerError({
        message: `Error fetching ${modelName}`,
        error: error.message,
      });
    }
  },  

  readFieldById: (Model, modelName) => async (req, res) => {
    const { _id, field } = req.params;
  
    try {
      if (!Object.keys(Model.schema.paths).includes(field)) {
        return res.badRequest({ message: `Field '${field}' not found in ${modelName}` });
      }
  
      const item = await Model.findById(_id).select(`${field} _id`);
  
      if (!item) {
        return res.notFound({ message: `${modelName} not found` });
      }
  
      res.success({
        [field]: item[field],
      });
    } catch (error) {
      res.internalServerError({
        message: `Error fetching ${modelName}`,
        error: error.message,
      });
    }
  },  
 
};

module.exports = singleRead;
