/**
 * auth.js
 * @description :: functions used in authentication
 */

const User = require('../model/user');
const dbService = require('../utils/dbService');
const userTokens = require('../model/userTokens');
const {
  JWT,LOGIN_ACCESS,
  PLATFORM,MAX_LOGIN_RETRY_LIMIT,LOGIN_REACTIVE_TIME,DEFAULT_SEND_LOGIN_OTP,SEND_LOGIN_OTP,FORGOT_PASSWORD_WITH,NO_OF_DEVICE_ALLOWED
} = require('../constants/authConstant');
const jwt = require('jsonwebtoken');
const common = require('../utils/common');
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');
const emailService = require('./email');
const smsService = require('./sms');
const ejs = require('ejs');
const uuid = require('uuid').v4;

/**
 * @description : generate JWT token for authentication.
 * @param {Object} user : user who wants to login.
 * @param {string} secret : secret for JWT.
 * @return {string}  : returns JWT token.
 */
const generateToken = async (user,secret) => {
  return jwt.sign( {
    id:user.id,
    'username':user.username
  }, secret, { expiresIn: JWT.EXPIRES_IN * 60 });
};

/**
 * @description : send email containing OTP.
 * @param {Object} user : user document.
 * @return {boolean} : returns true if succeed otherwise false.
 */
const sendEmailForLoginOtp = async (user) => {
  try {
    const where = { 
      _id:user.id,
      isActive: true,
      isDeleted: false,        
    };
    let otp = common.randomNumber();
    let expires = dayjs();
    expires = expires.add(6, 'hour').toISOString();
    await dbService.updateOne(User, where, {
      loginOTP: {
        code: otp,
        expireTime: expires 
      } 
    });
    let updatedUser = await dbService.findOne(User, where);
    
    let mailObj = {
      subject: 'Login OTP',
      to: user.email,
      template: '/views/email/OTP',
      data:{
        otp:otp,
        userName:updatedUser.username,
      }
    };
    await emailService.sendMail(mailObj);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * @description : login user.
 * @param {string} username : username of user.
 * @param {string} password : password of user.
 * @param {string} platform : platform.
 * @param {boolean} roleAccess: a flag to request user`s role access
 * @return {Object} : returns authentication status. {flag, data}
 */
const loginUser = async (username,password,platform,roleAccess) => {
  try {
    let where = { $or:[{ username:username },{ email:username }] };
    where.isActive =  true;where.isDeleted = false;            let user = await dbService.findOne(User,where);
    if (user) {
      const userToken = await dbService.count(userTokens, { $and:[{ tokenExpiredTime: { $gt: dayjs().toISOString() }, },{ isTokenExpired: 0, },{ userId:user.id }] } );
      if (userToken >= NO_OF_DEVICE_ALLOWED){
        return {
          flag: true,
          data: 'You have reached your device limit'
        };
      }
      if (user.loginRetryLimit >= MAX_LOGIN_RETRY_LIMIT){
        let now = dayjs();
        if (user.loginReactiveTime){
          let limitTime = dayjs(user.loginReactiveTime);
          if (limitTime > now){
            let expireTime = dayjs().add(LOGIN_REACTIVE_TIME,'minute');
            if (!(limitTime > expireTime)){
              return {
                flag:true,
                data:`you have exceed the number of limit.you can login after ${common.getDifferenceOfTwoDatesInTime(now,limitTime)}.`
              }; 
            }   
            await dbService.updateOne(User,{ _id:user.id },{
              loginReactiveTime:expireTime.toISOString(),
              loginRetryLimit:user.loginRetryLimit + 1  
            });
            return {
              flag:true,
              data:`you have exceed the number of limit.you can login after ${common.getDifferenceOfTwoDatesInTime(now,expireTime)}.`
            }; 
          } else {
            user = await dbService.updateOne(User,{ _id:user.id },{
              loginReactiveTime:'',
              loginRetryLimit:0
            },{ new:true });
          }
        } else {
          // send error
          let expireTime = dayjs().add(LOGIN_REACTIVE_TIME,'minute');
          await dbService.updateOne(User,
            {
              _id:user.id,
              isActive :true,
              isDeleted :false
            },
            {
              loginReactiveTime:expireTime.toISOString(),
              loginRetryLimit:user.loginRetryLimit + 1 
            });
          return {
            flag:true,
            data:`you have exceed the number of limit.you can login after ${common.getDifferenceOfTwoDatesInTime(now,expireTime)}.`
          }; 
        } 
      }
      if (password){
        const isPasswordMatched = await user.isPasswordMatch(password);
        if (!isPasswordMatched) {
          await dbService.updateOne(User,
            {
              _id:user.id,
              isActive :true,
              isDeleted : false
            },
            { loginRetryLimit:user.loginRetryLimit + 1 });
          return {
            flag:true,
            data:'Incorrect Password'
          };
        }
      }
      const userData = user.toJSON();
      let token;
      if (!user.userType){
        return {
          flag:true,
          data:'You have not been assigned any role'
        };
      }
      if (platform == PLATFORM.DEVICE){
        if (!LOGIN_ACCESS[user.userType].includes(PLATFORM.DEVICE)){
          return {
            flag:true,
            data:'you are unable to access this platform'
          };
        }
        token = await generateToken(userData,JWT.DEVICE_SECRET);
      }
      else if (platform == PLATFORM.ADMIN){
        if (!LOGIN_ACCESS[user.userType].includes(PLATFORM.ADMIN)){
          return {
            flag:true,
            data:'you are unable to access this platform'
          };
        }
        token = await generateToken(userData,JWT.ADMIN_SECRET);
      }
      if (user.loginRetryLimit){
        await dbService.updateOne(User,{ _id:user.id },{
          loginRetryLimit:0,
          loginReactiveTime:''
        });
      }
      let expire = dayjs().add(JWT.EXPIRES_IN, 'second').toISOString();
      await dbService.create(userTokens, {
        userId: user.id,
        token: token,
        tokenExpiredTime: expire 
      });
      let userToReturn = {
        ...userData,
        token 
      };
      if (roleAccess){
        userToReturn.roleAccess = await common.getRoleAccessData(user.id);
      }
      return {
        flag:false,
        data:userToReturn
      };
            
    } else {
      return {
        flag:true,
        data:'User not exists'
      };
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description : change password.
 * @param {Object} params : object of new password, old password and user`s id.
 * @return {Object}  : returns status of change password. {flag,data}
 */
const changePassword = async (params)=>{
  try {
    let password = params.newPassword;
    let oldPassword = params.oldPassword;
    let where = { 
      _id:params.userId,
      isActive: true,
      isDeleted: false,        
    };
    let user = await dbService.findOne(User,where);
    if (user && user.id) {
      let isPasswordMatch = await user.isPasswordMatch(oldPassword);
      if (!isPasswordMatch){
        return {
          flag:true,
          data:'Incorrect old password'
        };
      }
      password = await bcrypt.hash(password, 8);
      let updatedUser = dbService.updateOne(User,where,{ 'password':password });
      if (updatedUser) {
        return {
          flag:false,
          data:'Password changed successfully'
        };                
      }
      return {
        flag:true,
        data:'password can not changed due to some error.please try again'
      };
    }
    return {
      flag:true,
      data:'User not found'
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description : send notification on reset password.
 * @param {Object} user : user document
 * @return {}  : returns status where notification is sent or not
 */
const sendResetPasswordNotification = async (user) => {
  let resultOfEmail = false;
  let resultOfSMS = false;
  try {
    let where = { 
      _id:user.id,
      isActive: true,
      isDeleted: false,        
    };
    let token = uuid();
    let expires = dayjs();
    expires = expires.add(FORGOT_PASSWORD_WITH.EXPIRE_TIME, 'minute').toISOString();
    await dbService.updateOne(User,where,
      {
        resetPasswordLink: {
          code: token,
          expireTime: expires 
        } 
      });
    if (FORGOT_PASSWORD_WITH.LINK.email){
      let updatedUser = await dbService.findOne(User,where);
      let mailObj = {
        subject: 'Reset Password',
        to: user.email,
        template: '/views/email/ResetPassword',
        data:{ userName:updatedUser.username, }
      };
      try {
        await emailService.sendMail(mailObj);
        resultOfEmail = true;
      } catch (error) {
        console.log(error);
      }
    }
    if (FORGOT_PASSWORD_WITH.LINK.sms){
      let viewType = '/reset-password/';
      let link = `http://localhost:${process.env.PORT}${viewType + token}`;
      const msg = await ejs.renderFile(`${__basedir}/views/sms/resetPassword/html.ejs`, { link : link });
      let smsObj = {
        to:user.mobileNo,
        message:msg
      };
      try {
        await smsService.sendSMS(smsObj);
        resultOfSMS = true;
      } catch (error) {
        console.log(error);
      }
    }
    return {
      resultOfEmail,
      resultOfSMS
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description : reset password.
 * @param {Object} user : user document
 * @param {string} newPassword : new password to be set.
 * @return {}  : returns status whether new password is set or not. {flag, data}
 */
const resetPassword = async (user, newPassword) => {
  try {
    let where = { 
      _id:user.id,
      isActive: true,
      isDeleted: false,        
    };
    const dbUser = await dbService.findOne(User,where);
    if (!dbUser) {
      return {
        flag: true,
        data: 'User not found',
      };
    }
    newPassword = await bcrypt.hash(newPassword, 8);
    await dbService.updateOne(User, where, {
      'password': newPassword,
      resetPasswordLink: null,
      loginRetryLimit:0
    });
    let mailObj = {
      subject: 'Reset Password',
      to: user.email,
      template: '/views/email/successfulPasswordReset',
      data: {
        isWidth: true,
        email: user.email || '-',
        message: 'Your password has been changed Successfully.'
      }
    };
    await emailService.sendMail(mailObj);
    return {
      flag: false,
      data: 'Password reset successfully',
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description : send OTP for login.
 * @param {string} username : username of user.
 * @return {Object}  : returns status whether OTP is sent or not. {flag, data}
 */
const sendLoginOTP = async (username) => {
  try {
    let where = { $or:[{ username:username },{ email:username }] };
    where.isActive = true;where.isDeleted = false;        let user = await dbService.findOne(User,where);
    if (!user){
      return {
        flag:true,
        data:'User not found'
      };
    }
    if (user.loginRetryLimit >= MAX_LOGIN_RETRY_LIMIT){
      if (user.loginReactiveTime){
        let now = dayjs();
        let limitTime = dayjs(user.loginReactiveTime);
        if (limitTime > now){
          let expireTime = dayjs().add(LOGIN_REACTIVE_TIME,'minute').toISOString();
          await dbService.updateOne(User,where,{
            loginReactiveTime:expireTime,
            loginRetryLimit:user.loginRetryLimit + 1  
          });
          return {
            flag:true,
            data:`you have exceed the number of limit.you can login after ${LOGIN_REACTIVE_TIME} minutes.`
          }; 
        }
      } else {
        // send error
        let expireTime = dayjs().add(LOGIN_REACTIVE_TIME,'minute').toISOString();
        await dbService.updateOne(User,where,{
          loginReactiveTime:expireTime,
          loginRetryLimit:user.loginRetryLimit + 1 
        });
        return {
          flag:true,
          data:`you have exceed the number of limit.you can login after ${LOGIN_REACTIVE_TIME} minutes.`
        }; 
      } 
    }
    let res;
    if (DEFAULT_SEND_LOGIN_OTP === SEND_LOGIN_OTP.EMAIL){
      // send Email here
      res = await sendEmailForLoginOtp(user);
    } else if (DEFAULT_SEND_LOGIN_OTP === SEND_LOGIN_OTP.SMS){
      // send SMS here
    }
    if (!res){
      return {
        flag:true,
        data:'otp can not be sent due to some issue try again later.'
      };    
    }
    return {
      flag:false,
      data:'Please check your email for OTP'
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description : login with OTP.
 * @param {string} username : username of user.
 * @param {string} password : password of user.
 * @param {string} platform : platform.
 * @param {roleAccess} : a flag to request user`s role access
 * @return {Object}  : returns authentication object {flag,status}.
 */
const loginWithOTP = async (username, password, platform,roleAccess) => {
  try {
    let result = await loginUser(username, password, platform,roleAccess);
    if (!result.flag) {
      const where = { 
        _id:result.data.id,
        isActive: true,
        isDeleted: false,            
      };
      result.loginOTP = null;
      await dbService.updateOne(User,where,{ loginOTP: null });
    }
    return result;
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description :  Social Login.
 * @param {string} email : email of user.
 * @param {platform} platform : platform that user wants to access.
 * @return {boolean}  : returns status whether SMS is sent or not.
 */
const socialLogin = async (email,platform) => {
  try {
    const user = await dbService.findOne(User,{ email });
    if (user && user.email) {
      const userToken = await dbService.count(userTokens, { $and:[{ tokenExpiredTime: { $gt: dayjs().toISOString() }, },{ isTokenExpired: 0, },{ userId:user.id }] } );
      if (userToken >= NO_OF_DEVICE_ALLOWED){
        return {
          flag: true,
          data: 'You have reached your device limit'
        };
      }
      const { ...userData } = user.toJSON();
      if (!user.userType) {
        return {
          flag:true,
          data:'You have not been assigned any role'
        };
      }
      if (platform === undefined){
        return {
          flag:true,
          data:'Please login through Platform'
        };
      }
      if (!PLATFORM[platform.toUpperCase()] || !JWT[`${platform.toUpperCase()}_SECRET`]){
        return {
          flag: true,
          data: 'Platform not exists'
        };
      }
      if (!LOGIN_ACCESS[user.userType].includes(PLATFORM[platform.toUpperCase()])) {
        return {
          flag: true,
          data: 'you are unable to access this platform'
        };
      }
      let token = await generateToken(userData, JWT[`${platform.toUpperCase()}_SECRET`]);
      let expire = dayjs().add(JWT.EXPIRES_IN, 'second').toISOString();
      await dbService.create(userTokens, {
        userId: user.id,
        token: token,
        tokenExpiredTime: expire 
      });
      const userToReturn = {
        ...userData,
        token 
      };
      return {
        flag:false,
        data:userToReturn
      };
    }
    else {
      return {
        flag:true,
        data:'User/Email not exists'
      };
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * @description :  send password via SMS.
 * @param {string} user : user document.
 * @return {boolean}  : returns status whether SMS is sent or not.
 */
const sendPasswordBySMS = async (user) => {
  try {
    const msg = await ejs.renderFile(`${__basedir}/views/sms/initialPassword/html.ejs`, { password: user.password });
    let smsObj = {
      to: user.mobileNo,
      message: msg
    };
    await smsService.sendSMS(smsObj);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * @description : send password via Email.
 * @param {string} user : user document.
 * @return {boolean}  : returns status whether Email is sent or not.
 */
const sendPasswordByEmail = async (user) => {
  try {
    let msg = `Your Password for login : ${user.password}`;
    let mailObj = {
      subject: 'Your Password!',
      to: user.email,
      template: '/views/email/initialPassword',
      data: { message:msg }
    };
    try {
      await emailService.sendMail(mailObj);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports = {
  loginUser,
  changePassword,
  sendResetPasswordNotification,
  resetPassword,
  sendLoginOTP,
  loginWithOTP,
  socialLogin,
  sendPasswordBySMS,
  sendPasswordByEmail
};