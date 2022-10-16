/**
 * productRoutes.js
 * @description :: CRUD API routes for product
 */

const express = require('express');
const router = express.Router();
const productController = require('../../../controller/device/v1/productController');
const { PLATFORM } =  require('../../../constants/authConstant'); 
const auth = require('../../../middleware/auth');

router.route('/device/api/v1/product/create').post(auth(PLATFORM.DEVICE),productController.addProduct);
router.route('/device/api/v1/product/list').post(auth(PLATFORM.DEVICE),productController.findAllProduct);
router.route('/device/api/v1/product/count').post(auth(PLATFORM.DEVICE),productController.getProductCount);
router.route('/device/api/v1/product/softDeleteMany').put(auth(PLATFORM.DEVICE),productController.softDeleteManyProduct);
router.route('/device/api/v1/product/addBulk').post(auth(PLATFORM.DEVICE),productController.bulkInsertProduct);
router.route('/device/api/v1/product/updateBulk').put(auth(PLATFORM.DEVICE),productController.bulkUpdateProduct);
router.route('/device/api/v1/product/deleteMany').post(auth(PLATFORM.DEVICE),productController.deleteManyProduct);
router.route('/device/api/v1/product/softDelete/:id').put(auth(PLATFORM.DEVICE),productController.softDeleteProduct);
router.route('/device/api/v1/product/partial-update/:id').put(auth(PLATFORM.DEVICE),productController.partialUpdateProduct);
router.route('/device/api/v1/product/update/:id').put(auth(PLATFORM.DEVICE),productController.updateProduct);    
router.route('/device/api/v1/product/:id').get(auth(PLATFORM.DEVICE),productController.getProduct);
router.route('/device/api/v1/product/delete/:id').delete(auth(PLATFORM.DEVICE),productController.deleteProduct);

module.exports = router;
