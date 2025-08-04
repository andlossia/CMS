const buildFilters = (filters, validSearchableFields, schemaFields, keyword, language, maxKeywordLength, Model) => {
    const query = {};
  
   if (keyword && keyword.length <= maxKeywordLength) {
  const keywordConditions = validSearchableFields
    .filter(field => Model.schema.paths[field]?.instance === 'String')
    .map(field => {
      const localizedField = `${field}.${language}`;
      return schemaFields.includes(localizedField)
        ? { [localizedField]: { $regex: keyword, $options: 'i' } }
        : { [field]: { $regex: keyword, $options: 'i' } };
    });

  if (keywordConditions.length > 0) {
    query.$or = keywordConditions;
  }
} else if (keyword && keyword.length > maxKeywordLength) {
      throw new Error(`Keyword too long. Maximum length is ${maxKeywordLength} characters.`);
    }
  
    Object.entries(filters).forEach(([key, value]) => {
      if (key.startsWith('before') || key.startsWith('after') || key.startsWith('between')) {
        const field = key.slice(key.startsWith('before') ? 6 : key.startsWith('after') ? 5 : 8).toLowerCase();
  
        const isCreatedAtFilter = field === 'createdat';
  
        if (schemaFields.includes(field) || isCreatedAtFilter) {
          const fieldType = Model.schema.paths[field]?.instance;
          query[field] = query[field] || {};
  
          if (fieldType === 'Date') {
            const formattedDate = new Date(`20${value.slice(4)}-${value.slice(2, 4)}-${value.slice(0, 2)}`);
  
            if (key.startsWith('before')) {
              query[field]["$lt"] = formattedDate;
            } else if (key.startsWith('after')) {
              query[field]["$gt"] = formattedDate;
            } else if (key.startsWith('between')) {
              const [startDate, endDate] = value.split('-');
              query[field]["$gte"] = new Date(`20${startDate.slice(4)}-${startDate.slice(2, 4)}-${startDate.slice(0, 2)}`);
              query[field]["$lte"] = new Date(`20${endDate.slice(4)}-${endDate.slice(2, 4)}-${endDate.slice(0, 2)}`);
            }
          }
        } else {
          query[field] = query[field] || {};
          const formattedDate = new Date(`20${value.slice(4)}-${value.slice(2, 4)}-${value.slice(0, 2)}`);
          if (key.startsWith('before')) {
            query[field]["$lt"] = formattedDate;
          } else if (key.startsWith('after')) {
            query[field]["$gt"] = formattedDate;
          } else if (key.startsWith('between')) {
            const [startDate, endDate] = value.split('-');
            query[field]["$gte"] = new Date(`20${startDate.slice(4)}-${startDate.slice(2, 4)}-${startDate.slice(0, 2)}`);
            query[field]["$lte"] = new Date(`20${endDate.slice(4)}-${endDate.slice(2, 4)}-${endDate.slice(0, 2)}`);
          }
        }
      }
  
      else if (key.startsWith('min') || key.startsWith('max') || key.startsWith('between')) {
        const field = key.slice(3).charAt(0).toLowerCase() + key.slice(4);
        const operator = key.startsWith('min') ? '$gte' : key.startsWith('max') ? '$lte' : '$gte';
  
        if (schemaFields.includes(field) && !['Date'].includes(Model.schema.paths[field]?.instance)) {
          const fieldType = Model.schema.paths[field]?.instance;
          query[field] = query[field] || {};
  
          if (['Number', 'Decimal128', 'Int32', 'Int64', 'Timestamp', 'Double'].includes(fieldType)) {
            if (key.startsWith('between')) {
              const [startValue, endValue] = value.split(',');
              query[field]["$gte"] = Number(startValue);
              query[field]["$lte"] = Number(endValue);
            } else {
              query[field][operator] = Number(value);
            }
          }
        }
      }
  
  
      else if (key.startsWith('more') || key.startsWith('less')) {
        const field = key.slice(4).charAt(0).toLowerCase() + key.slice(5);
        if (schemaFields.includes(field)) {
          const operator = key.startsWith('more') ? '$size' : '$lt';
          query[field] = { [operator]: Number(value) };
        }
      } else if (schemaFields.includes(key)) {
        const fieldType = Model.schema.paths[key]?.instance;
        if (fieldType === 'Boolean') {
          query[key] = value === 'true';
        } else if (fieldType === 'String') {
          query[key] = { $regex: value, $options: 'i' };
        } else if (['Null', 'Undefined'].includes(fieldType)) {
          query[key] = { $not: { $exists: true } };
        } else {
          query[key] = value;
        }
      } else if (key.startsWith('contains')) {
        const field = key.slice(8).charAt(0).toLowerCase() + key.slice(9);
        if (schemaFields.includes(field)) {
          const fieldType = Model.schema.paths[field]?.instance;
          if (['Code', 'RegExp', 'Binary', 'Symbol'].includes(fieldType)) {
            query[field] = { $regex: value, $options: 'i' };
          }
        }
      }
    });
  
    return query;
  };

  module.exports = { buildFilters };
