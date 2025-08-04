const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const applyToJSON = require('../middlewares/applyToJson');

const hookSchema = new Schema({
  name: {
    type: String,
    required: true
  },

  hookType: {
    type: String,
    enum: [
      // Document lifecycle
      'preSave', 'postSave',
      'preUpdate', 'postUpdate',
      'preDelete', 'postDelete',
      // Query lifecycle
      'preFind', 'postFind',
      'preFindOne', 'postFindOne',
      'preValidate', 'postValidate'
    ],
    required: true
  },

  schemas: [{
    type: String,
    required: true
  }],

  fields: [String],

  condition: {
    type: Schema.Types.Mixed,
    default: {}
  },

  logic: {
    type: String,
    required: true
  },

  config: {
    timeout: { type: Number, default: 1000 },  
    retries: { type: Number, default: 0 },           
    sandbox: { type: Boolean, default: true },        
    async: { type: Boolean, default: true }          
  },

  metadata: {
    description: String,
    tags: [String],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }

}, { timestamps: true });

applyToJSON(hookSchema);

hookSchema.index({ hookType: 1 });
hookSchema.index({ schemas: 1 });
hookSchema.index({ 'metadata.tags': 1 });

module.exports = mongoose.model('Hook', hookSchema);
