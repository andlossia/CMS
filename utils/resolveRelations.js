const mongoose = require('mongoose');

/**
 * Recursively resolves all `relation`, `object`, and `array` fields based on schema definition
 */
const resolveRelationsWithSchema = async (data, schemaFields) => {
  if (!Array.isArray(schemaFields)) {
    throw new Error('resolveRelationsWithSchema: schemaFields must be an array');
  }

  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => resolveRelationsWithSchema(item, schemaFields)));
  }

  const result = { ...data };

  for (const field of schemaFields) {
    const value = result[field.name];

    if (value === undefined) continue;

    // 🎯 1. العلاقات (relation)
    if (field.type === 'relation') {
      if (typeof value === 'object' && value !== null) {
        result[field.name] = new mongoose.Types.ObjectId(value._id || value);
      } else {
        result[field.name] = new mongoose.Types.ObjectId(value);
      }
    }

    // 🎯 2. الكائنات المتداخلة (object)
    else if (field.type === 'object' && field.fields && typeof value === 'object') {
      result[field.name] = await resolveRelationsWithSchema(value, field.fields);
    }

    // 🎯 3. المصفوفات (array)
    else if (field.type === 'array' && field.fields && Array.isArray(value)) {
      result[field.name] = await Promise.all(
        value.map(v => resolveRelationsWithSchema(v, field.fields))
      );
    }

    // 🎯 4. الأنواع المتفرعة (enum variant)
    else if (field.type === 'string' && field.enum && typeof value === 'object') {
      const variantKey = result[field.name];
      const variantDef = field.enum[variantKey];

      if (variantDef?.fields) {
        result[variantKey] = await resolveRelationsWithSchema(
          value,
          variantDef.fields
        );
      }
    }

    // ✅ 5. باقي الأنواع تترك كما هي
    else {
      result[field.name] = value;
    }
  }

  return result;
};

module.exports = resolveRelationsWithSchema;
