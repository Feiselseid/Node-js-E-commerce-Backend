/**
 * index.js
 * @description :: exports function to send push notification using google-firebase
 */

const admin = require('firebase-admin');

const sendNotification = async (data) => {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GOOGLE_PROJECTID,
      clientEmail: process.env.GOOGLE_CLIENTEMAIL,
      privateKey: process.env.GOOGLE_PRIVATEKEY,
    }),
    databaseURL: process.env.GOOGLE_DATABASEURL,
  });
  const registrationToken = data.deviceId;

  const payload = { data: { MyKey: data.message, }, };
  const options = {
    priority: 'high',
    timeToLive: 60 * 60 * 24,
  };
  admin.messaging().sendToDevice(registrationToken, payload, options).then((response) => {
    console.log('successfully send message', response);
  })
    .catch((error) => {
      console.log('error sending message', error);
    });
};

module.exports = { sendNotification, };
