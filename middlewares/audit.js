const Audit = require('../models/audit');
const mongoose = require('mongoose');

const auditTrail = () => async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const trimObject = (obj) =>
      obj?.toObject?.() || (typeof obj === 'object' ? obj : null);

    if (req.audit?.bulk) {
      await Promise.all(
        req.audit.bulk.map(entry =>
          Audit.create({
            schemaName: entry.modelName,
            documentId: new mongoose.Types.ObjectId(entry.documentId),
            action: entry.action,
            performedBy: userId,
            changes: {
              ...(entry.before ? { before: trimObject(entry.before) } : {}),
              ...(entry.after ? { after: trimObject(entry.after) } : {})
            },
            metadata: { ip, userAgent }
          })
        )
      );
    } else if (req.audit) {
      const { modelName, documentId, action, before, after } = req.audit;
      await Audit.create({
        schemaName: modelName,
        documentId: new mongoose.Types.ObjectId(documentId),
        action,
        performedBy: userId,
        changes: {
          ...(before ? { before: trimObject(before) } : {}),
          ...(after ? { after: trimObject(after) } : {})
        },
        metadata: { ip, userAgent }
      });
    }
  } catch (err) {
    console.error('AuditTrail error:', err.message);
  }

  next();
};

module.exports = auditTrail;
