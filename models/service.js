const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const serviceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  schemas: [{ type: Schema.Types.ObjectId, ref: 'Schema' }],
  version: { type: String, default: "1.0.0" },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
