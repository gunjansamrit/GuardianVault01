const express = require("express");
const router = express.Router();
const AdminModel = require("../model/adminModel");






router.post('/signup',AdminModel.signup);
router.post('/login',AdminModel.login);
router.get('/getIndividualBackLog',AdminModel.getIndividualBackLog);
// router.get('/getRequestorBackLog',AdminModel.getRequestorBackLog);
router.post('/approval/individual',AdminModel.individualApproval);
// router.post('/approval/requestor',AdminModel.requestorApproval);





// Get all admins
// router.get('/all',AdminModel.getAllAdmins);

module.exports = router;
