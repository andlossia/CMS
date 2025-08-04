const { adminDB } = require('../database');

async function resolveSchemaWithInheritance(schemaName, visited = new Set()) {
  if (visited.has(schemaName)) {
    throw new Error(`Circular inheritance detected at "${schemaName}"`);
  }

  visited.add(schemaName);

  const schema = await adminDB().collection('schemas').findOne({
    $or: [
      { 'name.singular': schemaName },
      { 'name.plural': schemaName }
    ]
  });

  if (!schema) throw new Error(`Schema "${schemaName}" not found`);

  let mergedFields = schema.fields || [];
  let mergedBehaviors = { ...schema.behaviors };

  if (schema.parent) {
    const parent = await resolveSchemaWithInheritance(schema.parent, visited);

    const parentFieldNames = new Set(mergedFields.map(f => f.name));
    const parentFields = (parent.fields || []).filter(f => !parentFieldNames.has(f.name));
    mergedFields = [...parentFields, ...mergedFields];

    mergedBehaviors = {
      ...(parent.behaviors || {}),
      ...(schema.behaviors || {})
    };
  }

  return {
    ...schema,
    _id: schema._id?.toString?.() || schema._id,
    fields: mergedFields,
    behaviors: mergedBehaviors
  };
}

module.exports = {
  resolveSchemaWithInheritance
};
