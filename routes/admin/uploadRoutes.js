/**
 * uploadRoutes.js
 * @description :: routes of upload/download attachment
 */

const express = require('express');
const router = express.Router();
const fileUploadController = require('../../controller/admin/fileUploadController');

router.post('/admin/upload',fileUploadController.upload);

module.exports = router;