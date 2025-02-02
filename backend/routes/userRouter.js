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

router.get('/:userId/getItems',DataItemModel.getItemsByUserId);

router.post('/:userId/addItems',DataItemModel.addItem);

router.post('/giveConsent',ConsentModel.giveConsent);

router.get('/:userId/getConsentHistoryByUserId',ConsentHistoryModel.getConsentHistoryByUserId);

router.get('/:userId/getConsentListByUserId',ConsentModel.getConsentListByUserId);


module.exports = router; 
