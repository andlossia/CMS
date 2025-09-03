const mongoose = require('mongoose');

const resolveRelationsWithSchema = async (data, schemaFields) => {
  if (!Array.isArray(schemaFields)) {
    if (typeof schemaFields === 'object' && schemaFields !== null) {
      schemaFields = Object.values(schemaFields).flatMap(f => f.fields || []);
    } else {
      schemaFields = [];
    }
  }

  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => resolveRelationsWithSchema(item, schemaFields)));
  }

  const result = { ...data };

  for (const field of schemaFields) {
    const value = result[field.name];

    if (value === undefined) continue;

    if (field.type === 'relation') {
      if (typeof value === 'object' && value !== null) {
        result[field.name] = new mongoose.Types.ObjectId(value._id || value);
      } else {
        result[field.name] = new mongoose.Types.ObjectId(value);
      }
    }
    else if (field.type === 'object' && field.fields && typeof value === 'object') {
      result[field.name] = await resolveRelationsWithSchema(value, field.fields);
    }
    else if (field.type === 'array') {
      if (field.fields && Array.isArray(value)) {
        result[field.name] = await Promise.all(
          value.map(v => resolveRelationsWithSchema(v, field.fields))
        );
      } else {
        result[field.name] = value; 
      }
    }

    else if (field.type === 'string' && field.enum && typeof value === 'object') {
      const variantKey = result[field.name];
      const variantDef = field.enum[variantKey];
      if (variantDef?.fields) {
        result[variantKey] = await resolveRelationsWithSchema(value, variantDef.fields);
      }
    }
    else {
      result[field.name] = value;
    }
  }

  return result;
};

module.exports = resolveRelationsWithSchema;
