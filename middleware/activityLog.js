/**
 * activityLog.js
 * @description :: middleware used in logging activity of API calls
 */

let ActivityLog = require('../model/activityLog');
let dbService = require('../utils/dbService');
 
/**
 * @description : user activity logs related to routes will persist into database.
 * @param {Object} req : request of route.
 * @param {Object} res : response of route.
 * @param {callback} next : executes the next middleware succeeding the current middleware.
 */
const addActivityLog = async (req,res,next) => { 
  try {
    res.on('finish',async ()=>{
      let url = req.url;
      let routes = url.split('/');
      module = routes[1];
      let referenceId = '';
      let method = req.method;
      let action = getAction(url,req.method);
      if (req.params){
        referenceId = req.params.id || '';
      }
      let activityLog = new ActivityLog({
        details: {
          body:req.body || {},
          params:req.params || {}
        },
        route: req.originalUrl,
        module,
        referenceId,
        userId: req.user ? req.user.id : null,
        action,
        method
      });
      await dbService.create(ActivityLog, activityLog);
      console.log('activity log added');
    });
    next();
  }
  catch (error){
    next();
  }
};

/**
 * @description : returns action method for particular route.
 * @param {string} url : url of API.
 * @param {string} method : request method of API.
 * @return {string} : returns action of API.
 */
const getAction = (url,method) => {
  url = url.toLowerCase();
  let action;
  if (method === 'GET'){
    action = 'read';
  }
  else if (url.includes('delete')){
    action = 'delete';
  }
  else if (url.includes('create') || url.includes('addBulk')){
    action = 'create';
  } 
  else if (url.includes('update')) {
    action = 'update';
  }
  else if (url.includes('log') || url.includes('register') || url.includes('pass')){
    action = 'authentication';
  } else {
    action = 'custom';
  };
  
  return action;
};

module.exports = { addActivityLog };