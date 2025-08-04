const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const applyToJSON = require('../middlewares/applyToJson');
const { VM } = require('vm2');

// Enum variant schema
const enumVariantSchema = new Schema({
  label: { type: String },
  fields: [{ type: Schema.Types.Mixed }]
}, { _id: false });

// Field schema
const fieldSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  label: { type: String },
  description: { type: String },
  group: { type: String },

  required: { type: Boolean, default: false },
  unique: { type: Boolean, default: false },
  default: { type: Schema.Types.Mixed },
  pattern: { type: String },

  formable: { type: Boolean, default: true },
  listable: { type: Boolean, default: true },
  orderable : { type: Boolean, default: true },


  example: {
    valid: { type: String },
    invalid: { type: String }
  },

  enum: {
    type: Map,
    of: enumVariantSchema
  },

  validation: {
    type: Schema.Types.Mixed,
    default: {}
  },

  condition: {
    type: Schema.Types.Mixed,
    default: {}
  },

  index: {
    type: {
      type: String,
      enum: ['default', 'sparse', 'unique', 'text', 'hashed']
    },
    options: { type: Schema.Types.Mixed }
  },

  hashing: {
    algorithm: { type: String, enum: ['bcrypt'], default: 'bcrypt' },
    rounds: { type: Number, default: 12 }
  },

  encryption: {
    algorithm: { type: String, enum: ['aes-256-cbc'], default: 'aes-256-cbc' },
    secretKey: { type: String, select: false }
  },

  relation: {
    ref: { type: String },
    type: { type: String, enum: ['oneToOne', 'oneToMany', 'manyToMany'] },
    filter: { type: Schema.Types.Mixed },
    onDelete: {
      type: String,
      enum: ['cascade', 'setNull', 'restrict'],
      default: 'restrict'
    }
  },

  virtual: { type: Boolean, default: false },

  computed: {
    logic: { type: String },
    async: { type: Boolean, default: false }
  },

  access: {
    read: [{ type: String }],
    write: [{ type: String }]
  }

}, { _id: false });

// Main schema
const schemaSchema = new Schema({
  name: {
    singular: { type: String, required: true },
    plural: { type: String, required: true }
  },
  isSystem: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },

  auth: {
    allowAnonymousCreate: { type: Boolean, default: false },
  },
  description: { type: String },
  parent: { type: String },
  isAbstract: { type: Boolean, default: false },
  i18n: { type: Boolean, default: false },

  version: { type: Number, default: 1 },

  fields: [fieldSchema],

  permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
  hooks: [{ type: Schema.Types.ObjectId, ref: 'Hook' }],

  behaviors: {
    type: Map,
    of: String
  },

  audit: {
    enabled: { type: Boolean, default: false }
  },

  security: {
    permissionsEnabled: { type: Boolean, default: true }
  },

  metadata: {
    icon: { type: String },
    color: { type: String },
    tags: [{ type: String }]
  },

  sharing: {
    sourceSchemaId: { type: Schema.Types.ObjectId, ref: 'Schema', default: null },
    sharedBy: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    isFork: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    forkable: { type: Boolean, default: true },
    originVisibility: {
      type: String,
      enum: ['private', 'public', 'partners'],
      default: 'private'
    }
  }

}, { timestamps: true });

applyToJSON(schemaSchema);

// Secure hook logic
async function executeHookLogic(logic, context = {}) {
  try {
    const vm = new VM({
      timeout: 1000,
      sandbox: {
        ...context,
      },
      eval: false,
      wasm: false
    });
    return vm.run(logic);
  } catch (error) {
    console.error('Hook execution error:', error);
  }
}
// Hook registration
function registerHook(type, timing, getDoc) {
  schemaSchema[timing](type, async function (nextOrDoc, nextMaybe) {
    try {
      const isPost = timing.startsWith('post');
      const doc = isPost ? nextOrDoc : await getDoc.call(this);
      if (!doc) return (nextMaybe || nextOrDoc)();

      await doc.populate('hooks');
      for (const hook of doc.hooks || []) {
        const expected = `${timing}${type.charAt(0).toUpperCase()}${type.slice(1)}`;
        if (hook.hookType === expected && hook.logic) {
          await executeHookLogic(hook.logic, { doc });
        }
      }

      (nextMaybe || nextOrDoc)();
    } catch (err) {
      console.error(`Error running ${timing} ${type} hooks:`, err);
      (nextMaybe || nextOrDoc)(err);
    }
  });
}

// Hook bindings
registerHook('save', 'pre', function () { return this; });
registerHook('save', 'post', function () { return this; });
registerHook('findOneAndUpdate', 'pre', async function () {
  return await this.model.findOne(this.getQuery());
});
registerHook('findOneAndUpdate', 'post', function () { return this; });

module.exports = mongoose.model('Schema', schemaSchema, 'adminDB');
