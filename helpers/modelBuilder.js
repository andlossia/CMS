const mongoose = require('mongoose');
const normalizeCollectionName = require('./normalizeCollectionName');

function mapFieldType(type) {
  const normalized = typeof type === 'string' ? type.toLowerCase() : '';
  const typeMap = {
    'string': String,
    'number': Number,
    'boolean': Boolean,
    'bool': Boolean,
    'date': Date,
    'array': Array,
    'object': Object,
    'objectid': mongoose.Schema.Types.ObjectId,
    'oid': mongoose.Schema.Types.ObjectId,
    'mixed': mongoose.Schema.Types.Mixed,
    'any': mongoose.Schema.Types.Mixed,
    'decimal': mongoose.Schema.Types.Decimal128,
    'decimal128': mongoose.Schema.Types.Decimal128,
    'int': Number,
    'int32': Number,
    'int64': Number,
    'long': Number,
    'float': Number,
    'double': Number,
    'uuid': mongoose.Schema.Types.Buffer,
    'binary': mongoose.Schema.Types.Buffer,
    'bin': mongoose.Schema.Types.Buffer,
    'buffer': mongoose.Schema.Types.Buffer,
    'map': Map,
    'regexp': RegExp,
    'regex': RegExp,
    'symbol': String,
    'javascript': String,
    'javascriptwithscope': String,
    'timestamp': Date,
    'undefined': undefined,
    'null': null,
    'minkey': mongoose.Schema.Types.Mixed,
    'maxkey': mongoose.Schema.Types.Mixed,
    'enum': String,
    'relation': mongoose.Schema.Types.ObjectId,
  };

  if (Array.isArray(type)) {
    if (type[0]) return [mapFieldType(type[0])];
    return [];
  }

  if (!typeMap[normalized]) {
    console.warn(`⚠️ Unknown type "${type}", defaulting to Mixed`);
  }

  return typeMap[normalized] || mongoose.Schema.Types.Mixed;
}

function buildField(field) {
  // 🧱 إذا كان object يحتوي على حقول متداخلة
  if (field.type === 'object' && Array.isArray(field.fields)) {
    const nestedFields = {};
    for (const sub of field.fields) {
      nestedFields[sub.name] = buildField(sub);
    }
    return {
      type: new mongoose.Schema(nestedFields, { _id: false }),
      required: field.required || false
    };
  }

  // 📦 إذا كان array of embedded objects
  if (field.type === 'array' && Array.isArray(field.fields)) {
    const nestedFields = {};
    for (const sub of field.fields) {
      nestedFields[sub.name] = buildField(sub);
    }
    return {
      type: [new mongoose.Schema(nestedFields, { _id: false })],
      required: field.required || false,
      default: field.default || []
    };
  }

  // 🔄 إذا كان array عادي
  if (Array.isArray(field.type)) {
    const itemType = mapFieldType(field.type[0] || 'mixed');
    return {
      type: [itemType],
      required: field.required || false,
      default: field.default || []
    };
  }

  // ✅ الحقول العادية
  const fieldType = mapFieldType(field.type);
  const fieldDef = {
    type: fieldType,
    required: field.required || false,
    unique: field.unique || false
  };

  if (field.default !== undefined) fieldDef.default = field.default;
  if (field.index) fieldDef.index = true;

  // 🧩 enum كـ مصفوفة أو كائن
  if (field.enum) {
    if (Array.isArray(field.enum)) {
      fieldDef.enum = field.enum.map(opt =>
        typeof opt === 'object' && opt.label ? String(opt.label) : String(opt)
      );
    } else if (typeof field.enum === 'object') {
      fieldDef.enum = Object.keys(field.enum);
    } else {
      fieldDef.enum = [String(field.enum)];
    }
  }

  // 🔗 علاقة
  if (field.relation?.ref) {
    fieldDef.type = mongoose.Schema.Types.ObjectId;
    fieldDef.ref = field.relation.ref;
  }

  // 🌍 توصيف إضافي
  if (field.description || field.label || field.i18n) {
    fieldDef.meta = {
      description: field.description,
      label: field.label,
      i18n: field.i18n
    };
  }

  if (field.validate) fieldDef.validate = field.validate;

  return fieldDef;
}

async function modelBuilder(schemaDoc) {
  if (!schemaDoc || !Array.isArray(schemaDoc.fields)) {
    throw new Error('❌ Invalid schema: "fields" must be an array.');
  }

  const fields = {};
  for (const field of schemaDoc.fields) {
    if (!field.name || !field.type) {
      throw new Error(`❌ Field "${field.name || 'unknown'}" is missing name or type.`);
    }
    fields[field.name] = buildField(field);
  }

  const options = {
    timestamps: true,
    versionKey: false,
  };

  const dynamicSchema = new mongoose.Schema(fields, options);

  // ⛓️ Attach hooks (if defined)
  if (Array.isArray(schemaDoc.hooks) && schemaDoc.hooks.length > 0) {
    const { getHookById, attachHook } = require('./hookLoader');
    for (const hookId of schemaDoc.hooks) {
      const hookDoc = await getHookById(hookId);
      if (hookDoc) attachHook(dynamicSchema, hookDoc);
    }
  }

  const modelName = normalizeCollectionName(schemaDoc.name?.endpoint);
  const collectionName = normalizeCollectionName(schemaDoc.name?.collection);

  // 🧠 important: check if model already registered to avoid overwrite errors
  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  const model = mongoose.model(modelName, dynamicSchema, collectionName);
  return model;
}


module.exports = modelBuilder;