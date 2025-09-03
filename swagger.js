const swaggerUi = require('swagger-ui-express');
const normalizeCollectionName = require('./helpers/normalizeCollectionName');
const { loadAllSchemas } = require('./database');

const mapFieldToSchema = (field) => {
  const schema = {};
  const type = (field.type || 'string').toLowerCase();

  // Relation
  if (type === 'relation' && field.relation) {
    return {
      type: 'object',
      description: `Relation to schema: ${field.relation.ref}\nRelation type: ${field.relation.type}`,
      properties: {
        ref: { type: 'string', description: `Schema reference: ${field.relation.ref}` },
        type: { type: 'string', description: `Relation type: ${field.relation.type}` }
      },
      required: ['ref', 'type']
    };
  }

  // Enum (Map or Object)
  if (field.enum) {
    schema.type = 'object';
    schema.properties = {};
    const entries = field.enum instanceof Map ? [...field.enum.entries()] : Object.entries(field.enum);

    for (const [key, variant] of entries) {
      const variantSchema = { type: 'object', properties: {} };
      if (variant.label) variantSchema.description = `Label: ${variant.label}`;
      if (variant.fields && Array.isArray(variant.fields)) {
        for (const subField of variant.fields) {
          variantSchema.properties[subField.name] = mapFieldToSchema(subField);
        }
      }
      schema.properties[key] = variantSchema;
    }
    return schema;
  }

  // Object
  if (type === 'object' && field.fields) {
    schema.type = 'object';
    schema.properties = {};
    for (const subField of field.fields) {
      schema.properties[subField.name] = mapFieldToSchema(subField);
    }
  }
  // Array
  else if (type === 'array') {
    schema.type = 'array';
    if (field.fields && field.fields.length === 1) {
      schema.items = mapFieldToSchema(field.fields[0]);
    } else {
      schema.items = { type: 'string' };
    }
  }
  // Primitive
  else {
    schema.type = type;
  }

  // Description & Label
  if (field.description) schema.description = field.description;
  if (field.label) schema.description = (schema.description || '') + `\nLabel: ${field.label}`;

  // Example
  if (field.example?.valid || field.example?.invalid) {
    schema.example = {
      valid: field.example.valid || '',
      invalid: field.example.invalid || '',
    };
  }

  return schema;
};


const setupSwagger = async (app) => {
  const generateSwaggerSpec = async (schemas) => {
    const paths = {};
    const components = { schemas: {} };

    for (const schema of schemas) {
      const endpoint = normalizeCollectionName(schema.name?.endpoint);
      const collection = normalizeCollectionName(schema.name?.collection);
      if (!endpoint || !collection) continue;

      const basePath = `/${endpoint}`;
      const properties = {};

      if (schema.fields && Array.isArray(schema.fields)) {
        for (const field of schema.fields) {
          properties[field.name] = mapFieldToSchema(field);
        }
      }

      components.schemas[endpoint] = { type: 'object', properties };

      // CRUD Endpoints
      paths[basePath] = {
        get: {
          tags: [collection],
          summary: `List all ${collection} using sort and filter`,
          responses: { 200: { description: 'List of items', content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${endpoint}` } } } } } },
        },
        post: {
          tags: [collection],
          summary: `Create a new ${endpoint}`,
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${endpoint}` } } } },
          responses: { 201: { description: `${endpoint} created`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${endpoint}` } } } } },
        },
      };

      paths[`${basePath}/:id`] = {
        get: {
          tags: [collection],
          summary: `Get ${endpoint} by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: `${endpoint} data`, content: { 'application/json': { schema: { $ref: `#/components/schemas/${endpoint}` } } } }, 404: { description: 'Not found' } },
        },
        put: { tags: [collection], summary: `Update ${endpoint} by ID`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${endpoint}` } } } }, responses: { 200: { description: 'Updated successfully' } } },
        patch: { tags: [collection], summary: `Partial update ${endpoint} by ID`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${endpoint}` } } } }, responses: { 200: { description: 'Updated successfully' } } },
        delete: { tags: [collection], summary: `Delete ${endpoint} by ID`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted successfully' } } },
      };

      paths[`${basePath}/:id/soft`] = {
        delete: { tags: [collection], summary: `Soft delete ${endpoint}`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Soft deleted successfully' } } },
      };

      paths[`${basePath}/:id/restore`] = {
        patch: { tags: [collection], summary: `Restore soft-deleted ${endpoint}`, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Restored successfully' } } },
      };

      paths[`${basePath}/bulk`] = {
        post: { tags: [collection], summary: `Create many ${collection}`, requestBody: { required: true, content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${endpoint}` } } } } }, responses: { 201: { description: `Multiple ${collection} created` } } },
        put: { tags: [collection], summary: `Update many ${collection}`, requestBody: { required: true, content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${endpoint}` } } } } }, responses: { 200: { description: `Multiple ${collection} updated` } } },
        patch: { tags: [collection], summary: `Patch many ${collection}`, requestBody: { required: true, content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${endpoint}` } } } } }, responses: { 200: { description: `Multiple ${collection} patched` } } },
        delete: { tags: [collection], summary: `Delete many ${collection}`, requestBody: { required: true, content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${endpoint}` } } } } }, responses: { 200: { description: `Multiple ${collection} deleted` } } },
      };
    }

    return {
      openapi: '3.0.0',
      info: { title: 'Dynamic API Docs', version: '1.0.0', description: 'Generated from schema definitions.' },
      servers: [{ url: 'http://localhost:4010/api/v1', description: 'API v1' }],
      paths,
      components,
    };
  };

  try {
    const schemas = await loadAllSchemas();
    const swaggerSpec = await generateSwaggerSpec(schemas);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  } catch (err) {
    console.error('❌ Failed to setup Swagger:', err);
  }
};

module.exports = setupSwagger;
