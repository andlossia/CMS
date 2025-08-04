const { getGatewayPlugin } = require('./getGatewayPlugin');
const { validatePayloadAgainstSchema } = require('../../utils/schemaValidator');
const { adminDB, dataDB } = require('../../database');
const paymentHandler = require('./paymentHandler');

const processPayment = async (req, res) => {
  try {
    console.log('📌 Received Request Body:', JSON.stringify(req.body, null, 2));

    const { order: orderPayload, payment: paymentInfo } = req.body;

    await validatePayloadAgainstSchema('order', orderPayload, adminDB);
    await validatePayloadAgainstSchema('payment', paymentInfo, adminDB);

    let totalAmount = 0;
    const items = [];

    for (const item of orderPayload.items) {
      const qty = item.product.quantity || 1;
      const price = item.product.unit_price || 0;
      const totalPrice = qty * price;
      totalAmount += totalPrice;

      items.push({
        name: item.product._id?.toString() || 'Product',
        type: 'C',
        unit_price: price,
        units_number: qty
      });
    }

    if (orderPayload.shipping?.price) {
      totalAmount += orderPayload.shipping.price;
      items.push({
        name: 'Shipping',
        type: 'C',
        unit_price: orderPayload.shipping.price,
        units_number: 1
      });
    }

 
    const orderResult = await adminDB.collection('orders').insertOne({
      ...orderPayload,
      status: 'pending',
      created_at: new Date(),
    });

    const orderId = orderResult.insertedId;
    const validInstallments = Math.max(1, paymentInfo.installments_number || 1);
    const validPaymentPlan = validInstallments > 1 ? 8 : (paymentInfo.payment_plan || 1);
    const [expire_month, expire_year] = (paymentInfo.expiryDate || '').split('/').map(s => parseInt(s, 10));

    const client = [
      { name: 'contact', value: req.user.fullName },
      { name: 'email', value: req.user.email },
      { name: 'phone', value: req.user.phoneNumber }
    ];

    const gatewayPayload = {
      terminal_name: process.env.TRANZILA_TERMINAL_NAME,
      expire_month,
      expire_year,
      cvv: paymentInfo.cvv?.toString(),
      card_number: paymentInfo.cardNumber?.toString(),
      card_holder_id: paymentInfo.card_holder_id?.toString(),
      payment_plan: validPaymentPlan,
      installments_number: validInstallments,
      items,
      user_defined_fields: client,
      response_language: 'english'
    };

    const pluginName = paymentInfo.gateway || 'tranzila';
    const selectedPlugin = getGatewayPlugin(pluginName);
    const response = await selectedPlugin.makegatewayRequest(gatewayPayload);

    return await paymentHandler(
      response,
      res,
      orderId,
      orderPayload.customer,
      null,
      pluginName,
      orderPayload.shipping?._id?.toString()
    );
  } catch (error) {
    console.error('❌ Error processing payment:', error.message);

    if (error.validationErrors) {
      return res.badRequest({
        message: 'Validation failed',
        errors: error.validationErrors
      });
    }

    return res.internalServerError({
      message: 'Payment processing failed',
      error: error.message
    });
  }
};

module.exports = { processPayment };
