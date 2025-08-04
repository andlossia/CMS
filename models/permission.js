const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const applyToJSON = require('../middlewares/applyToJson');

const accessRuleSchema = new Schema({
  self: { type: Boolean, default: false },         
  other: { type: Boolean, default: false },        
  allowAnonymous: { type: Boolean, default: false }
}, { _id: false });

const crudAccessSchema = new Schema({
  single: accessRuleSchema,
  bulk: accessRuleSchema
}, { _id: false });

const rolePermissionSchema = new Schema({
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },

  access: {
    create: crudAccessSchema,
    read: crudAccessSchema,
    update: crudAccessSchema,
    delete: crudAccessSchema
  },

  fieldAccess: {
    allow: [{ type: String }],
    deny: [{ type: String }],
    priority: {
      type: String,
      enum: ['allow-overrides', 'deny-overrides'],
      default: 'deny-overrides'
    }
  },

  conditions: {
    type: Map,
    of: Schema.Types.Mixed 
  },

  customActions: [String]
}, { _id: false });

const globalAccessSchema = new Schema({
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: true },
  update: { type: Boolean, default: false },
  delete: { type: Boolean, default: false }
}, { _id: false });

const permissionSchema = new Schema({
  schemaName: {
    type: String,
    required: true,
    index: true
  },

  strategy: {
    type: String,
    enum: ['strict', 'default', 'inherit'],
    default: 'default'
  },

  roles: [rolePermissionSchema],

  globalAccess: globalAccessSchema,

  metadata: {
    label: { type: String },
    description: { type: String },
    tags: [{ type: String }]
  }
}, { timestamps: true });

applyToJSON(permissionSchema);

module.exports = mongoose.model('Permission', permissionSchema);
