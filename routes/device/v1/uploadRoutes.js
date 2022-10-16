/**
 * uploadRoutes.js
 * @description :: routes of upload/download attachment
 */

const express = require('express');
const router = express.Router();
const fileUploadController = require('../../../controller/device/v1/fileUploadController');

router.post('/device/api/v1/upload',fileUploadController.upload);

module.exports = router;