const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const applyToJSON = require('../middlewares/applyToJson');

const auditSchema = new Schema({
  schemaName: {
    type: String,
    required: true,
    index: true
  },

  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  action: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'import', 'export', 'hardDelete', 'restore'],
    required: true
  },

  initiatedBy: {
    type: String,
    enum: ['user', 'system', 'api', 'cron'],
    default: 'user'
  },

  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  performedByRole: {
    type: String 
  },

  changes: {
    before: { type: Object },
    after: { type: Object }
  },

  diff: {
    type: Object, 
    default: {}
  },

  reason: {
    type: String 
  },

  metadata: {
    ip: String,
    userAgent: String,
    location: {
      country: String,
      city: String
    },
    custom: Schema.Types.Mixed 
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }

}, { timestamps: false });

applyToJSON(auditSchema);

auditSchema.index({ schemaName: 1, documentId: 1, timestamp: -1 });

module.exports = mongoose.model('Audit', auditSchema);
