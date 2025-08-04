const { loadSchema, dataDB, adminDB } = require('../../database');
const { VM } = require('vm2');
const { ObjectId } = require('mongodb');

function evaluateDynamicCondition(evaluator, cond, cart, user, now) {
  try {
    const vm = new VM({
      timeout: 100,
      sandbox: { cond, cart, user, now }
    });
    return vm.run(evaluator.code);
  } catch (err) {
    console.error('Condition eval error:', err);
    return false;
  }
}

function executeReward(executor, reward, cart, user) {
  try {
    const vm = new VM({
      timeout: 100,
      sandbox: { reward, cart, user }
    });
    const result = vm.run(executor.code);
    return typeof result === 'number' ? { type: reward.type, value: result } : result;
  } catch (err) {
    console.error('Reward eval error:', err);
    return null;
  }
}

async function applyCoupon(couponDoc, cart, user, now = new Date()) {
  if (couponDoc.valid_from && now < new Date(couponDoc.valid_from)) return { applied: false };
  if (couponDoc.valid_until && now > new Date(couponDoc.valid_until)) return { applied: false };
  if (!couponDoc.engine) return { applied: false };

  const engineId = typeof couponDoc.engine === 'string' ? new ObjectId(couponDoc.engine) : couponDoc.engine;
  const engine = await dataDB.collection('coupon-engines').findOne({ _id: engineId });
  if (!engine) return { applied: false };

  const [conditions, rewards] = await Promise.all([
    dataDB.collection('coupon-conditions').find({ _id: { $in: engine.conditions || [] } }).toArray(),
    (engine.rewards?.rewards?.length
      ? dataDB.collection('coupon-rewards').find({ _id: { $in: engine.rewards.rewards } }).toArray()
      : []
    )
  ]);

  const evaluatorSchema = await loadSchema('coupon-engine');

  const evaluateConditionTree = (nodes, logic = 'AND') => {
    const results = nodes.map(cond => {
      if (cond.rules?.length) {
        return evaluateConditionTree(cond.rules, cond.logic || 'AND');
      } else {
        const evaluator = evaluatorSchema.conditions?.[cond.type];
        if (!evaluator) return false;
        return evaluateDynamicCondition(evaluator, cond, cart, user, now);
      }
    });
    return logic === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);
  };

  const allConditionsMet = evaluateConditionTree(conditions, engine.logic || 'AND');
  if (!allConditionsMet) return { applied: false };

  const appliedRewards = rewards.map(reward => {
    const executor = evaluatorSchema.rewards?.[reward.type];
    if (!executor) return null;
    return executeReward(executor, reward, cart, user);
  }).filter(Boolean);

  return {
    applied: true,
    rewards: appliedRewards,
    totalDiscount: appliedRewards.reduce((sum, r) => sum + (r?.value || 0), 0),
    coupon: couponDoc.code
  };
}

// ✅ دالة جديدة مخصصة للاستخدام من التشيك أوت
async function applyCouponToOrderPayload(orderPayload, user) {
  let totalAmount = 0;

  const cart = {
    items: orderPayload.items.map(item => {
      const qty = item.product.quantity || 1;
      const price = item.product.unit_price || 0;
      totalAmount += qty * price;
      return {
        _id: item.product._id,
        quantity: qty,
        unit_price: price,
        categories: item.product.categories || [],
        sellerId: item.product.seller || null
      };
    }),
    total: totalAmount
  };

  if (orderPayload.shipping?.price) {
    totalAmount += orderPayload.shipping.price;
  }

  let appliedCoupon = null;

  if (orderPayload.coupon?.code) {
    const couponDoc = await adminDB().collection('coupons').findOne({ code: orderPayload.coupon.code });
    if (couponDoc) {
      const result = await applyCoupon(couponDoc, cart, user);
      if (result.applied && result.totalDiscount > 0) {
        appliedCoupon = {
          code: couponDoc.code,
          discount: result.totalDiscount,
          rewards: result.rewards
        };

        orderPayload.coupon = appliedCoupon;
        orderPayload.total = totalAmount - result.totalDiscount;
      }
    }
  }

  return orderPayload;
}

module.exports = {
  applyCoupon,
  applyCouponToOrderPayload
};
