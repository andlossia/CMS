const swaggerUi = require('swagger-ui-express');
const normalizeCollectionName = require('./helpers/normalizeCollectionName');

const {loadAllSchemas}  = require('./database');

const setupSwagger = async (app) => {
  const generateSwaggerSpec = async (schemas) => {
    const paths = {};
    const components = { schemas: {} };

    for (const schema of schemas) {
      const endpoint = normalizeCollectionName(schema.name?.singular);
      const collection = normalizeCollectionName(schema.name?.plural);


      if (!endpoint || !collection) continue;

      const basePath = `/${endpoint}`;

      const properties = {};
      if (schema.fields && Array.isArray(schema.fields)) {
        for (const field of schema.fields) {
          const fieldSpec = {
            type: field.type?.toLowerCase() || 'string',
            description: field.description || '',
          };

          if (field.label) {
            fieldSpec.description += `\nLabel: ${field.label}`;
          }

          if (field.example?.valid || field.example?.invalid) {
            fieldSpec.example = {
              valid: field.example.valid || '',
              invalid: field.example.invalid || '',
            };
          }

          properties[field.name] = fieldSpec;
        }
      }

      components.schemas[endpoint] = {
        type: 'object',
        properties,
      };

      paths[basePath] = {
        get: {
          tags: [collection],
          summary: `List all ${collection} using sort and filter`,
          responses: {
            200: {
              description: 'List of items',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: `#/components/schemas/${endpoint}` },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: [collection],
          summary: `Create a new ${endpoint}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${endpoint}` },
              },
            },
          },
          responses: {
            201: {
              description: `${endpoint} created`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${endpoint}` },
                },
              },
            },
          },
        },
      };

    
      paths[`${basePath}/:id`] = {
        get: {
          tags: [collection],
          summary: `Get ${endpoint} by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: `${endpoint} data`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${endpoint}` },
                },
              },
            },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: [collection],
          summary: `Update ${endpoint} by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${endpoint}` },
              },
            },
          },
          responses: { 200: { description: 'Updated successfully' } },
        },
        patch: {
          tags: [collection],
          summary: `Partial update ${endpoint} by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${endpoint}` },
              },
            },
          },
          responses: { 200: { description: 'Updated successfully' } },
        },
        delete: {
          tags: [collection],
          summary: `Delete ${endpoint} by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Deleted successfully' } },
        },
      };

      paths[`${basePath}/:id/soft`] = {
        delete: {
          tags: [collection],
          summary: `Soft delete ${endpoint}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Soft deleted successfully' } },
        },
      };

      paths[`${basePath}/:id/restore`] = {
        patch: {
          tags: [collection],
          summary: `Restore soft-deleted ${endpoint}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Restored successfully' } },
        },
      };

        paths[`${basePath}/bulk`] = {
        post: {
          tags: [collection],
          summary: `Create many ${collection}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${endpoint}` },
                },
              },
            },
          },
          responses: {
            201: { description: `Multiple ${collection} created` },
          },
        },
        put: {
          tags: [collection],
          summary: `Update many ${collection}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${endpoint}` },
                },
              },
            },
          },
          responses: {
            200: { description: `Multiple ${collection} updated` },
          },
        },
        patch: {
          tags: [collection],
          summary: `Patch many ${collection}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${endpoint}` },
                },
              },
            },
          },
          responses: {
            200: { description: `Multiple ${collection} patched` },
          },
        },
        delete: {
          tags: [collection],
          summary: `Delete many ${collection}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${endpoint}` },
                },
              },
            },
          },
          responses: {
            200: { description: `Multiple ${collection} deleted` },
          },
        },
      };

    }

    return {
      openapi: '3.0.0',
      info: {
        title: 'Dynamic API Docs',
        version: '1.0.0',
        description: 'This documentation is generated dynamically from the schema definitions.',
      },
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