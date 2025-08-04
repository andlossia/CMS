const { ObjectId } = require('mongodb');
const sendEmail = require('../notification/email/emailSender');
const { dataDB } = require('../../database');


async function getErrorMapping(code, gateway = 'default', lang = 'ar') {
  const doc = await dataDB()
    .collection('error-mappings')
    .findOne({ code, gateway });

  if (!doc) {
    return {
      status: 400,
      code,
      message: 'Unknown application error',
    };
  }

  const label = doc.label?.find(l => l.lang === lang)
    || doc.label?.find(l => l.lang === 'en')
    || doc.label?.[0];

  return {
    status: doc.status || 400,
    code,
    message: label?.message || 'Unknown application error',
  };
}


const paymentHandler = async (response, res, orderId, userId, gateway = 'default', lang = 'ar') => {
  if (!response || typeof response !== 'object') {
    return res.internalServerError({
      message: 'Invalid response received from payment gateway',
      error: 'Response format is incorrect',
    });
  }

 
  const trx = response.transaction_result;
  const code = trx?.processor_response_code;

  if (response.error_code && response.error_code !== 0) {
    const { status, message } = await getErrorMapping(response.error_code, gateway, lang);
    return res.status(status).json({
      error_code: response.error_code,
      message: response.message || message,
    });
  }

  if (!trx || code !== '000') {
    return res.badRequest({
      message: 'Payment could not be verified as successful.',
      error: `Invalid transaction response code: ${code}`,
      transaction_result: trx,
    });
  }

  const db = dataDB();
  const session = db.client.startSession();

  try {
    const [order, user] = await Promise.all([
      db.collection('orders').findOne({ _id: new ObjectId(orderId) }),
      db.collection('users').findOne({ _id: new ObjectId(userId) }),
    ]);

    if (!order) return res.notFound({ message: 'Order not found.' });
    if (!user) return res.notFound({ message: 'User not found.' });

    let updatedOrder, transactionDoc;

    await session.withTransaction(async () => {
      await db.collection('orders').updateOne(
        { _id: order._id },
        { $set: { status: 'completed', paid_at: new Date() } },
        { session }
      );

      updatedOrder = await db.collection('orders').findOne({ _id: order._id }, { session });

      transactionDoc = {
        order: order._id,
        user: user._id,
        amount: Number(trx.amount || 0),
        status: 'Completed',
        transaction_id: trx.transaction_id,
        provider: gateway,
        raw_response: response,
        created_at: new Date(),
      };

      await db.collection('transactions').insertOne(transactionDoc, { session });

      await db.collection('users').updateOne(
        { _id: user._id },
        { $addToSet: { orders: order._id } },
        { session }
      );
    });

    await session.endSession();

    await sendEmail(
      user.email,
      '🎉 شكراً على طلبك!',
      `<h2>شكرًا لك، ${user.name}!</h2>
       <p>لقد أكملت عملية الشراء بنجاح.</p>
       <a href="https://planet-p.com/profile">تتبع الطلب</a>`
    );

    return res.success({
      message: 'Payment processed successfully.',
      order: updatedOrder,
      transaction: transactionDoc,
    });

  } catch (error) {
    console.error('❌ Error processing payment response:', error);
    await session.endSession();
    return res.internalServerError({
      message: 'Error processing payment response.',
      error: error.message,
    });
  }
};

module.exports = paymentHandler;
