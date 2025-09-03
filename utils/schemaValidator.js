const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

const normalizeCollectionName = require('../helpers/normalizeCollectionName');
// استخدم loadSchema و adminDB من database service
const { loadSchema, adminDB } = require('../database');

function deepSet(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  while (parts.length > 1) {
    const key = parts.shift();
    current[key] = current[key] || { type: 'object', properties: {} };
    current = current[key].properties;
  }
  current[parts[0]] = value;
}

function convertToJsonSchema(schemaDoc) {
  function convertField(field) {
    let jsonField = {};

    switch (field.type) {
      case 'string':
        jsonField.type = 'string';
        if (field.pattern) jsonField.pattern = field.pattern;
        break;
      case 'number':
        jsonField.type = 'number';
        break;
      case 'boolean':
        jsonField.type = 'boolean';
        break;
      case 'array':
        jsonField.type = 'array';
        jsonField.items = { type: 'string' };
        break;
      case 'object':
        jsonField.type = 'object';
        const nested = convertFields(field.fields || []);
        jsonField.properties = nested.properties;
        if (nested.required.length) jsonField.required = nested.required;
        break;
      case 'relation':
        jsonField.type = 'string';
        break;
      case 'date':
        jsonField.type = 'string';
        jsonField.format = 'date-time';
        break;
      default:
        jsonField.type = 'string';
    }

    if (Array.isArray(field.enum)) {
      jsonField.enum = field.enum;
    }

    return jsonField;
  }

  function convertFields(fields) {
    const props = {};
    const req = [];
    let oneOfConditions = [];

    for (const field of fields) {
      if (
        field.enum &&
        field.type === 'string' &&
        typeof field.enum === 'object' &&
        !Array.isArray(field.enum)
      ) {
        const variants = [];
        for (const [variantKey, variantValue] of Object.entries(field.enum)) {
          const variantFields = convertFields(variantValue.fields || []);
          variants.push({
            if: {
              properties: {
                [field.name]: { const: variantKey }
              },
              required: [field.name]
            },
            then: {
              properties: variantFields.properties,
              required: variantFields.required
            }
          });
        }

        deepSet(props, field.name, { type: 'string', enum: Object.keys(field.enum) });
        oneOfConditions = oneOfConditions.concat(variants);
        if (field.required) req.push(field.name);
        continue;
      }

      const jsonField = convertField(field);
      deepSet(props, field.name, jsonField);
      if (field.required) req.push(field.name);
    }

    return { properties: props, required: req, oneOfConditions };
  }

  const { properties, required, oneOfConditions } = convertFields(schemaDoc.fields || []);

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties,
    required,
    allOf: oneOfConditions.length ? oneOfConditions : undefined
  };
}

async function findSchemaDoc(schemaName) {
  // 1) حاول loadSchema (إذا كان موجوداً في database.js)
  if (typeof loadSchema === 'function') {
    try {
      const s = await loadSchema(schemaName);
      if (s) return s;
    } catch (err) {
      // لا توقف التنفيذ هنا — نجرب fallback
      console.warn('loadSchema failed or returned nothing:', err?.message || err);
    }
  }

  // 2) fallback: حاول استخدام adminDB() إن كانت موجودة
  if (typeof adminDB === 'function') {
    const db = adminDB();
    if (db && typeof db.collection === 'function') {
      // حاول البحث بعدة مفاتيح: singular, plural, normalized
      const attempts = [
        { q: { 'name.endpoint': schemaName } },
        { q: { 'name.collection': schemaName } },
        { q: { 'name.endpoint': schemaName.toLowerCase() } },
        { q: { 'name.collection': schemaName.toLowerCase() } },
        { q: { 'name.collection': normalizeCollectionName(schemaName) } }
      ];
      for (const a of attempts) {
        try {
          const doc = await db.collection('schemas').findOne(a.q);
          if (doc) return doc;
        } catch (err) {
          // ignore and continue
        }
      }
    } else {
      console.warn('adminDB() returned invalid db instance');
    }
  }

  return null;
}


function getSchemaValidator(schemaName) {
  return async (req, res, next) => {
    try {
      const schemaDoc = await findSchemaDoc(schemaName);
      if (!schemaDoc) {
        return res.notFound({ message: `Schema "${schemaName}" not found.` });
      }

      const jsonSchema = convertToJsonSchema(schemaDoc);
      const validate = ajv.compile(jsonSchema);

      const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
      const allValid = items.every(item => validate(item));

      if (!allValid) {
        return res.badRequest({
          message: 'Validation failed',
          errors: (validate.errors || []).map(err => ({
            field: (err.instancePath || '').replace(/^\//, '') || '(root)',
            message: err.message
          }))
        });
      }

      next();
    } catch (err) {
      console.error('Validation Error:', err);
      res.internalServerError({ message: 'Schema validation failed', error: err.message });
    }
  };
}

async function validatePayloadAgainstSchema(schemaName, payload) {
  const schemaDoc = await findSchemaDoc(schemaName);
  if (!schemaDoc) throw new Error(`Schema "${schemaName}" not found`);

  const jsonSchema = convertToJsonSchema(schemaDoc);
  const validate = ajv.compile(jsonSchema);

  const valid = validate(payload);
  if (!valid) {
    const errors = (validate.errors || []).map(e => ({
      field: e.instancePath.replace(/^\//, '') || '(root)',
      message: e.message
    }));
    const error = new Error('Validation failed');
    error.validationErrors = errors;
    throw error;
  }

  return true;
}

module.exports = {
  convertToJsonSchema,
  getSchemaValidator,
  validatePayloadAgainstSchema
};
