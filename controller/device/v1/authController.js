/**
 * authController.js
 * @description :: exports authentication methods
 */

const User = require('../../../model/user');
const dbService = require('../../../utils/dbService');
const userTokens = require('../../../model/userTokens');
const PushNotification = require('../../../model/pushNotification');
const dayjs = require('dayjs');
const userSchemaKey = require('../../../utils/validation/userValidation');
const validation = require('../../../utils/validateRequest');
const authConstant = require('../../../constants/authConstant');
const authService =  require('../../../services/auth');
const common = require('../../../utils/common');

/**
 * @description : user registration 
 * @param {Object} req : request for register
 * @param {Object} res : response for register
 * @return {Object} : response for register {status, message, data}
 */
const register = async (req,res) =>{
  try {
    let validateRequest = validation.validateParamsWithJoi(
      req.body,
      userSchemaKey.schemaKeys
    );
    if (!validateRequest.isValid) {
      return res.validationError({ message :  `Invalid values in parameters, ${validateRequest.message}` });
    } 
    let isEmptyPassword = false;
    if (!req.body.password){
      isEmptyPassword = true;
      req.body.password = Math.random().toString(36).slice(2);
    }
    const data = new User({
      ...req.body,
      userType: authConstant.USER_TYPES.User
    });

    let checkUniqueFields = await common.checkUniqueFieldsInDatabase(User,[ 'username', 'email' ],data,'REGISTER');
    if (checkUniqueFields.isDuplicate){
      return res.validationError({ message : `${checkUniqueFields.value} already exists.Unique ${checkUniqueFields.field} are allowed.` });
    }

    const result = await dbService.create(User,data);
    if (isEmptyPassword && req.body.email){
      await authService.sendPasswordByEmail({
        email: req.body.email,
        password: req.body.password
      });
    }
    if (isEmptyPassword && req.body.mobileNo){
      await authService.sendPasswordBySMS({
        mobileNo: req.body.mobileNo,
        password: req.body.password
      });
    }
    return res.success({ data :result });
  } catch (error) {
    return res.internalServerError({ data:error.message }); 
  }  
};
/**
 * @description : send OTP to user for login
 * @param {Object} req : request for sendOtpForLogin
 * @param {Object} res : response for sendOtpForLogin
 * @return {Object} : response for sendOtpForLogin {status, message, data}
 */
const sendOtpForLogin = async (req,res)=>{
  try {
    let params = req.body;
    if (!params.username){
      return res.badRequest({ message : 'Insufficient request parameters! username is required.' });
    }
    let result = await authService.sendLoginOTP(params.username);
    if (result.flag){
      return res.failure({ message : result.data });
    }
    return res.success({ message :result.data });
  } catch (error) {
    return res.internalServerError({ data:error.message }); 
  }
};

/**
 * @description : login with username and OTP
 * @param {Object} req : request for loginWithOTP
 * @param {Object} res : response for loginWithOTP
 * @return {Object} : response for loginWithOTP {status, message, data}
 */
const loginWithOTP = async (req, res) => {
  const params = req.body;
  try {
    if (!params.code || !params.username) {
      return res.badRequest({ message : 'Insufficient request parameters! username and code is required.' });
    }
    let where = { $or:[{ username:params.username },{ email:params.username }] };
    where.isActive = true;where.isDeleted = false;            let user = await dbService.findOne(User,where);
    if (!user || !user.loginOTP.expireTime) {
      return res.badRequest({ message :'Invalid Code' });
    }
    if (dayjs(new Date()).isAfter(dayjs(user.loginOTP.expireTime))) {
      return res.badRequest({ message :'Your reset password link is expired' });
    }
    if (user.loginOTP.code !== params.code){
      return res.badRequest({ message :'Invalid Code' });
    }
    let roleAccess = false;
    if (req.body.includeRoleAccess){
      roleAccess = req.body.includeRoleAccess;
    }
    let result = await authService.loginWithOTP(params.username,null,authConstant.PLATFORM.DEVICE,roleAccess);
    if (result.flag){
      return res.badRequest({ message : result.data });
    }
    return res.success({ data: result.data });
  } catch (error) {
    return res.internalServerError({ data:error.message }); 
  }
};

/**
 * @description : logout user
 * @param {Object} req : request for logout
 * @param {Object} res : response for logout
 * @return {Object} : response for logout {status, message, data}
 */
const logout = async (req, res) => {
  try {
    let userToken = await dbService.findOne(userTokens, {
      token: (req.headers.authorization).replace('Bearer ', '') ,
      userId:req.user.id
    });
    let updatedDocument = { isTokenExpired: true };
    await dbService.updateOne(userTokens,{ _id:userToken.id }, updatedDocument);
    let found = await dbService.findOne(PushNotification,{ userId:req.user.id  });
    if (found){
      await dbService.updateOne(PushNotification,{ _id :found.id },{ isActive:false });
    }
    return res.success({ message :'Logged Out Successfully' });
  } catch (error) {
    return res.internalServerError({ data:error.message }); 
  }
};

/**
 * @description : adding PlayerIDs to send push notification
 * @param {Object} req : request for addPlayerId
 * @param {Object} res : response for addPlayerId
 * @return {Object} : response for addPlayerId {status, message, data}
 */
const addPlayerId = async (req, res) => {
  try {
    let params = req.body;
    if ( !params.userId || !params.playerId){
      return res.badRequest({ message : 'Insufficient request parameters! userId and playerId is required.' });
    }
    let found = await dbService.findOne(PushNotification,{ userId:params.userId });
    if (found){
      await dbService.updateOne(PushNotification,{ _id :found.id },{ playerId:params.playerId });
    } else {
      await dbService.create(PushNotification,params);
    }
    return res.success({ message : 'PlayerId added' });
  } catch (error){
    return res.internalServerError({ data:error.message }); 
  }
};

/**
 * @description : removing PlayerIDs to send push notification
 * @param {Object} req : request for removePlayerId
 * @param {Object} res : response for removePlayerId
 * @return {Object} : response for removePlayerId {status, message, data}
 */
const removePlayerId = async (req, res) => {
  try {
    let params = req.body;
    if (!params.deviceId){
      return res.badRequest({ message : 'Insufficient request parameters! deviceId is required.' });
    }
    await dbService.deleteOne(PushNotification,{ deviceId:params.deviceId });
    return res.success({ message :'PlayerId Removed' });
  } catch (error){
    return res.internalServerError({ data:error.message }); 
  }
};     

module.exports = {
  register,
  sendOtpForLogin,
  loginWithOTP,
  logout,
  addPlayerId,
  removePlayerId
};