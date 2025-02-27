const express = require("express");
const router = express.Router();
const userModel = require("../model/userModel");
const DataItemModel = require("../model/dataItemModel");
const ConsentModel = require("../model/consentModel");
const CredentialModel = require("../model/credentialModel");
const ConsentHistoryModel = require("../model/consentHistoryModel");
const { verifyJwtToken } = require("../utils/jwtToken");

router.post('/signup', userModel.signup);
router.post('/login',userModel.login);
// router.get('/getAllUsers',userModel.getAllUsers);


router.get('/:userId/getUserData', userModel.getUserData);
router.get('/:userId/getItems',DataItemModel.getItemsByUserId);

router.post('/:userId/addItems',DataItemModel.addItem);

// (Rishabh) - added delete and edit items
router.post('/:userId/deleteItems', DataItemModel.deleteItem);
router.post('/:userId/editItems', DataItemModel.updateItem);


router.post('/giveConsent',ConsentModel.giveConsent);
router.get('/:userId/getConsentListByUserId',ConsentModel.getConsentListByUserId);



router.get('/:userId/getConsentHistoryByUserId',ConsentHistoryModel.getConsentHistoryByUserId);




module.exports = router; 
