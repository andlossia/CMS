const { loadSchema, loadAllSchemas } = require('../database');
const normalizeCollectionName = require('../helpers/normalizeCollectionName');
const applyFieldSecurity = require('../middlewares/applyFieldSecurity');
const { resolveSchemaWithInheritance } = require('../utils/schemaResolver');



const getAllSchemas = async (req, res) => {
  try {
    const schemas = await loadAllSchemas(); 
    const formattedSchemas = schemas.map(schema => ({
      ...schema,
      _id: schema._id.toString()
    }));
    res.success({ schemas: formattedSchemas });
  } catch (error) {
    console.error('Get All Schemas Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while fetching schemas' });
  }
};

const getSchema = async (req, res) => {
  try {
    const name = normalizeCollectionName(req.params.name);
    const schema = await loadSchema(name);
    if (!schema) {
      return res.notFound({ success: false, message: 'Schema not found' });
    }
    res.success({ schema });
  } catch (error) {
    console.error('Get Schema Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while fetching the schema' });
  }
};

const getSchemaBranch = async (req, res) => {
  try {
    const { name } = req.params;
    const {
      mode = 'self',
      includeSelf = 'false',
      depth = '0',
      fieldsOnly = 'false',
      group: groupFilter,
      type: typeFilter,
      pathToRoot = 'false'
    } = req.query;

    const includeSelfBool = includeSelf === 'true';
    const fieldsOnlyBool = fieldsOnly === 'true';
    const showPath = pathToRoot === 'true';
    const maxDepth = parseInt(depth, 10);

    const allSchemas = await loadAllSchemas();
    const schemaMap = allSchemas.reduce((acc, schema) => ({ ...acc, [schema.name.endpoint]: schema }), {});
    const target = await loadSchema(name);

    if (!target) {
      return res.notFound({ success: false, message: 'Schema not found' });
    }

    if (showPath) {
      const path = [];
      let current = target;
      while (current) {
        path.unshift({ name: current.name, description: current.description || null });
        current = current.parent ? schemaMap[current.parent] : null;
      }
      return res.success({ path });
    }

    const getChildren = (parent, level = 0) => {
      if (maxDepth && level >= maxDepth) return [];
      const children = allSchemas.filter(s => s.parent === parent.name.endpoint);
      return children.flatMap(c => [c, ...getChildren(c, level + 1)]);
    };

    const getAncestors = (node) => {
      const ancestors = [];
      let current = node;
      while (current?.parent) {
        current = schemaMap[current.parent];
        if (current) ancestors.unshift(current);
      }
      return ancestors;
    };

    const getSiblings = (node) =>
      node.parent
        ? allSchemas.filter(s => s.parent === node.parent && s.name.endpoint !== node.name.endpoint)
        : [];

    const isLeaf = (node) => !allSchemas.some(s => s.parent === node.name.endpoint);

    const buildTree = (node) => ({
      ...node,
      children: allSchemas
        .filter(s => s.parent === node.name.endpoint)
        .map(buildTree)
    });

    const groupByParent = () => {
      const groups = {};
      for (const s of allSchemas) {
        const parentKey = s.parent || 'root';
        groups[parentKey] = groups[parentKey] || [];
        groups[parentKey].push(s);
      }
      return groups;
    };

    const filterFields = (fields) =>
      fields.filter(f => {
        if (groupFilter && f.group !== groupFilter) return false;
        if (typeFilter && f.type !== typeFilter) return false;
        return true;
      });

    let result;
    switch (mode) {
      case 'self': result = includeSelfBool ? target : null; break;
      case 'children': result = getChildren(target, 1); break;
      case 'descendants': result = getChildren(target); break;
      case 'siblings': result = includeSelfBool ? [target, ...getSiblings(target)] : getSiblings(target); break;
      case 'ancestors': result = getAncestors(target); break;
      case 'leaf': result = isLeaf(target); break;
      case 'groupByParent': result = groupByParent(); break;
      case 'tree': result = buildTree(target); break;
      default: return res.badRequest({ success: false, message: 'Invalid mode' });
    }

    if (fieldsOnlyBool) {
      if (Array.isArray(result)) {
        result = result.map(s => ({ name: s.name, fields: filterFields(s.fields || []) }));
      } else if (result && result.fields) {
        result = { name: result.name, fields: filterFields(result.fields) };
      }
    }

    res.success({ result });
  } catch (error) {
    console.error('getSchemaBranch Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while processing schema branch' });
  }
};

const updateSchema = async (req, res) => {
  try {
    const { name } = req.params;
    const { schema } = req.body;

    if (!schema || !schema.name) {
      return res.badRequest({ success: false, message: 'Invalid schema data' });
    }

    const result = await adminDB().collection('schemas').updateOne(
      { 'name.endpoint': name },
      { $set: schema }
    );

    if (result.matchedCount === 0) {
      return res.notFound({ success: false, message: 'Schema not found' });
    }

    await loadAllSchemas(true);

    res.success({ success: true, message: 'Schema updated successfully' });
  } catch (error) {
    console.error('Update Schema Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while updating the schema' });
  }
};

const deleteSchema = async (req, res) => {
  try {
    const { name } = req.params;

    const result = await adminDB().collection('schemas').deleteOne({ 'name.endpoint': name });

    if (result.deletedCount === 0) {
      return res.notFound({ success: false, message: 'Schema not found' });
    }

    await loadAllSchemas(true); 

    res.success({ success: true, message: 'Schema deleted successfully' });
  } catch (error) {
    console.error('Delete Schema Error:', error);
    res.internalServerError({ success: false, message: 'Something went wrong while deleting the schema' });
  }
};

module.exports = {
  getAllSchemas,
  getSchema,
  getSchemaBranch,
  updateSchema,
  deleteSchema
};
