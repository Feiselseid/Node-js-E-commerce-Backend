/**
 * productController.js
 * @description : exports action methods for product.
 */

const Product = require('../../model/product');
const productSchemaKey = require('../../utils/validation/productValidation');
const validation = require('../../utils/validateRequest');
const dbService = require('../../utils/dbService');
const ObjectId = require('mongodb').ObjectId;
const utils = require('../../utils/common');
   
/**
 * @description : create document of Product in mongodb collection.
 * @param {Object} req : request including body for creating document.
 * @param {Object} res : response of created document
 * @return {Object} : created Product. {status, message, data}
 */ 
const addProduct = async (req, res) => {
  try {
    let dataToCreate = { ...req.body || {} };
    let validateRequest = validation.validateParamsWithJoi(
      dataToCreate,
      productSchemaKey.schemaKeys);
    if (!validateRequest.isValid) {
      return res.validationError({ message : `Invalid values in parameters, ${validateRequest.message}` });
    }
    dataToCreate.addedBy = req.user.id;
    dataToCreate = new Product(dataToCreate);
    let createdProduct = await dbService.create(Product,dataToCreate);
    return res.success({ data : createdProduct });
  } catch (error) {
    return res.internalServerError({ message:error.message }); 
  }
};
    
/**
 * @description : create multiple documents of Product in mongodb collection.
 * @param {Object} req : request including body for creating documents.
 * @param {Object} res : response of created documents.
 * @return {Object} : created Products. {status, message, data}
 */
const bulkInsertProduct = async (req,res)=>{
  try {
    if (req.body && (!Array.isArray(req.body.data) || req.body.data.length < 1)) {
      return res.badRequest();
    }
    let dataToCreate = [ ...req.body.data ];
    for (let i = 0;i < dataToCreate.length;i++){
      dataToCreate[i] = {
        ...dataToCreate[i],
        addedBy: req.user.id
      };
    }
    let createdProducts = await dbService.create(Product,dataToCreate);
    createdProducts = { count: createdProducts ? createdProducts.length : 0 };
    return res.success({ data:{ count:createdProducts.count || 0 } });
  } catch (error){
    return res.internalServerError({ message:error.message });
  }
};
    
/**
 * @description : find all documents of Product from collection based on query and options.
 * @param {Object} req : request including option and query. {query, options : {page, limit, pagination, populate}, isCountOnly}
 * @param {Object} res : response contains data found from collection.
 * @return {Object} : found Product(s). {status, message, data}
 */
const findAllProduct = async (req,res) => {
  try {
    let options = {};
    let query = {};
    let validateRequest = validation.validateFilterWithJoi(
      req.body,
      productSchemaKey.findFilterKeys,
      Product.schema.obj
    );
    if (!validateRequest.isValid) {
      return res.validationError({ message: `${validateRequest.message}` });
    }
    if (typeof req.body.query === 'object' && req.body.query !== null) {
      query = { ...req.body.query };
    }
    if (req.body.isCountOnly){
      let totalRecords = await dbService.count(Product, query);
      return res.success({ data: { totalRecords } });
    }
    if (req.body && typeof req.body.options === 'object' && req.body.options !== null) {
      options = { ...req.body.options };
    }
    let foundProducts = await dbService.paginate( Product,query,options);
    if (!foundProducts || !foundProducts.data || !foundProducts.data.length){
      return res.recordNotFound(); 
    }
    return res.success({ data :foundProducts });
  } catch (error){
    return res.internalServerError({ message:error.message });
  }
};
        
/**
 * @description : find document of Product from table by id;
 * @param {Object} req : request including id in request params.
 * @param {Object} res : response contains document retrieved from table.
 * @return {Object} : found Product. {status, message, data}
 */
const getProduct = async (req,res) => {
  try {
    let query = {};
    if (!ObjectId.isValid(req.params.id)) {
      return res.validationError({ message : 'invalid objectId.' });
    }
    query._id = req.params.id;
    let options = {};
    let foundProduct = await dbService.findOne(Product,query, options);
    if (!foundProduct){
      return res.recordNotFound();
    }
    return res.success({ data :foundProduct });
  }
  catch (error){
    return res.internalServerError({ message:error.message });
  }
};
    
/**
 * @description : returns total number of documents of Product.
 * @param {Object} req : request including where object to apply filters in req body 
 * @param {Object} res : response that returns total number of documents.
 * @return {Object} : number of documents. {status, message, data}
 */
const getProductCount = async (req,res) => {
  try {
    let where = {};
    let validateRequest = validation.validateFilterWithJoi(
      req.body,
      productSchemaKey.findFilterKeys,
    );
    if (!validateRequest.isValid) {
      return res.validationError({ message: `${validateRequest.message}` });
    }
    if (typeof req.body.where === 'object' && req.body.where !== null) {
      where = { ...req.body.where };
    }
    let countedProduct = await dbService.count(Product,where);
    return res.success({ data : { count: countedProduct } });
  } catch (error){
    return res.internalServerError({ message:error.message });
  }
};
    
/**
 * @description : update document of Product with data by id.
 * @param {Object} req : request including id in request params and data in request body.
 * @param {Object} res : response of updated Product.
 * @return {Object} : updated Product. {status, message, data}
 */
const updateProduct = async (req,res) => {
  try {
    let dataToUpdate = {
      ...req.body,
      updatedBy:req.user.id,
    };
    let validateRequest = validation.validateParamsWithJoi(
      dataToUpdate,
      productSchemaKey.updateSchemaKeys
    );
    if (!validateRequest.isValid) {
      return res.validationError({ message : `Invalid values in parameters, ${validateRequest.message}` });
    }
    const query = { _id:req.params.id };
    let updatedProduct = await dbService.updateOne(Product,query,dataToUpdate);
    if (!updatedProduct){
      return res.recordNotFound();
    }
    return res.success({ data :updatedProduct });
  } catch (error){
    return res.internalServerError({ message:error.message });
  }
};

/**
 * @description : update multiple records of Product with data by filter.
 * @param {Object} req : request including filter and data in request body.
 * @param {Object} res : response of updated Products.
 * @return {Object} : updated Products. {status, message, data}
 */
const bulkUpdateProduct = async (req,res)=>{
  try {
    let filter = req.body && req.body.filter ? { ...req.body.filter } : {};
    let dataToUpdate = {};
    delete dataToUpdate['addedBy'];
    if (req.body && typeof req.body.data === 'object' && req.body.data !== null) {
      dataToUpdate = { 
        ...req.body.data,
        updatedBy : req.user.id
      };
    }
    let updatedProduct = await dbService.updateMany(Product,filter,dataToUpdate);
    if (!updatedProduct){
      return res.recordNotFound();
    }
    return res.success({ data :{ count : updatedProduct } });
  } catch (error){
    return res.internalServerError({ message:error.message }); 
  }
};
    
/**
 * @description : partially update document of Product with data by id;
 * @param {obj} req : request including id in request params and data in request body.
 * @param {obj} res : response of updated Product.
 * @return {obj} : updated Product. {status, message, data}
 */
const partialUpdateProduct = async (req,res) => {
  try {
    if (!req.params.id){
      res.badRequest({ message : 'Insufficient request parameters! id is required.' });
    }
    delete req.body['addedBy'];
    let dataToUpdate = {
      ...req.body,
      updatedBy:req.user.id,
    };
    let validateRequest = validation.validateParamsWithJoi(
      dataToUpdate,
      productSchemaKey.updateSchemaKeys
    );
    if (!validateRequest.isValid) {
      return res.validationError({ message : `Invalid values in parameters, ${validateRequest.message}` });
    }
    const query = { _id:req.params.id };
    let updatedProduct = await dbService.updateOne(Product, query, dataToUpdate);
    if (!updatedProduct) {
      return res.recordNotFound();
    }
    return res.success({ data:updatedProduct });
  } catch (error){
    return res.internalServerError({ message:error.message });
  }
};
/**
 * @description : deactivate document of Product from table by id;
 * @param {Object} req : request including id in request params.
 * @param {Object} res : response contains updated document of Product.
 * @return {Object} : deactivated Product. {status, message, data}
 */
const softDeleteProduct = async (req,res) => {
  try {
    if (!req.params.id){
      return res.badRequest({ message : 'Insufficient request parameters! id is required.' });
    }
    let query = { _id:req.params.id };
    const updateBody = {
      isDeleted: true,
      updatedBy: req.user.id,
    };
    let updatedProduct = await dbService.updateOne(Product, query, updateBody);
    if (!updatedProduct){
      return res.recordNotFound();
    }
    return res.success({ data:updatedProduct });
  } catch (error){
    return res.internalServerError({ message:error.message }); 
  }
};

/**
 * @description : delete document of Product from table.
 * @param {Object} req : request including id as req param.
 * @param {Object} res : response contains deleted document.
 * @return {Object} : deleted Product. {status, message, data}
 */
const deleteProduct = async (req,res) => {
  try { 
    if (!req.params.id){
      return res.badRequest({ message : 'Insufficient request parameters! id is required.' });
    }
    const query = { _id:req.params.id };
    const deletedProduct = await dbService.deleteOne(Product, query);
    if (!deletedProduct){
      return res.recordNotFound();
    }
    return res.success({ data :deletedProduct });
        
  }
  catch (error){
    return res.internalServerError({ message:error.message });
  }
};
    
/**
 * @description : delete documents of Product in table by using ids.
 * @param {Object} req : request including array of ids in request body.
 * @param {Object} res : response contains no of documents deleted.
 * @return {Object} : no of documents deleted. {status, message, data}
 */
const deleteManyProduct = async (req, res) => {
  try {
    let ids = req.body.ids;
    if (!ids || !Array.isArray(ids) || ids.length < 1) {
      return res.badRequest();
    }
    const query = { _id:{ $in:ids } };
    const deletedProduct = await dbService.deleteMany(Product,query);
    if (!deletedProduct){
      return res.recordNotFound();
    }
    return res.success({ data :{ count :deletedProduct } });
  } catch (error){
    return res.internalServerError({ message:error.message }); 
  }
};
/**
 * @description : deactivate multiple documents of Product from table by ids;
 * @param {Object} req : request including array of ids in request body.
 * @param {Object} res : response contains updated documents of Product.
 * @return {Object} : number of deactivated documents of Product. {status, message, data}
 */
const softDeleteManyProduct = async (req,res) => {
  try {
    let ids = req.body.ids;
    if (!ids || !Array.isArray(ids) || ids.length < 1) {
      return res.badRequest();
    }
    const query = { _id:{ $in:ids } };
    const updateBody = {
      isDeleted: true,
      updatedBy: req.user.id,
    };
    let updatedProduct = await dbService.updateMany(Product,query, updateBody);
    if (!updatedProduct) {
      return res.recordNotFound();
    }
    return res.success({ data:{ count :updatedProduct } });
        
  } catch (error){
    return res.internalServerError({ message:error.message }); 
  }
};

module.exports = {
  addProduct,
  bulkInsertProduct,
  findAllProduct,
  getProduct,
  getProductCount,
  updateProduct,
  bulkUpdateProduct,
  partialUpdateProduct,
  softDeleteProduct,
  deleteProduct,
  deleteManyProduct,
  softDeleteManyProduct    
};