/**
 * activityLogValidation.js
 * @description :: validate each post and put request as per activityLog model
 */

const joi = require('joi');
const {
  options, isCountOnly, populate, select 
} = require('./commonFilterValidation');

/** validation keys and properties of activityLog */
exports.schemaKeys = joi.object({
  details: joi.object(),
  route: joi.string().allow(null).allow(''),
  module: joi.string().allow(null).allow(''),
  action: joi.string().allow(null).allow(''),
  referenceId: joi.string().allow(null).allow(''),
  loggedInUser: joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).allow(''),
  method: joi.string().allow(null).allow(''),
  isDeleted: joi.boolean()
}).unknown(true);

/** validation keys and properties of activityLog for updation */
exports.updateSchemaKeys = joi.object({
  details: joi.object(),
  route: joi.string().allow(null).allow(''),
  module: joi.string().allow(null).allow(''),
  action: joi.string().allow(null).allow(''),
  referenceId: joi.string().allow(null).allow(''),
  loggedInUser: joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).allow(''),
  method: joi.string().allow(null).allow(''),
  isDeleted: joi.boolean(),
  _id: joi.string().regex(/^[0-9a-fA-F]{24}$/)
}).unknown(true);

let keys = ['query', 'where'];
/** validation keys and properties of activityLog for filter documents from collection */
exports.findFilterKeys = joi.object({
  options: options,
  ...Object.fromEntries(
    keys.map(key => [key, joi.object({
      details: joi.alternatives().try(joi.array().items(),joi.object(),joi.object()),
      route: joi.alternatives().try(joi.array().items(),joi.string(),joi.object()),
      module: joi.alternatives().try(joi.array().items(),joi.string(),joi.object()),
      action: joi.alternatives().try(joi.array().items(),joi.string(),joi.object()),
      referenceId: joi.alternatives().try(joi.array().items(),joi.string(),joi.object()),
      loggedInUser: joi.alternatives().try(joi.array().items(),joi.string().regex(/^[0-9a-fA-F]{24}$/),joi.object()),
      method: joi.alternatives().try(joi.array().items(),joi.string(),joi.object()),
      isDeleted: joi.alternatives().try(joi.array().items(),joi.boolean(),joi.object()),
      id: joi.any(),
      _id: joi.alternatives().try(joi.array().items(),joi.string().regex(/^[0-9a-fA-F]{24}$/),joi.object())
    }).unknown(true),])
  ),
  isCountOnly: isCountOnly,
  populate: joi.array().items(populate),
  select: select
    
}).unknown(true);
