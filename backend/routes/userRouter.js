const express = require("express");
const router = express.Router();
const userModel = require("../model/userModel");
const DataItemModel = require("../model/dataItemModel");
const ConsentModel = require("../model/consentModel");
const CredentialModel = require("../model/credentialModel");
const ConsentHistoryModel = require("../model/consentHistoryModel");

router.post('/signup', userModel.signup);
router.post('/login',CredentialModel.login);
router.get('/getAllUsers',userModel.getAllUsers);
router.get('/:userId/getItems',DataItemModel.getItemsByUserId);
router.post('/:userId/addItems',DataItemModel.addItem);

router.post('/giveConsent',ConsentModel.giveConsent);
router.post('/:seeker/accessItem',ConsentModel.accessItem);

router.get('/:userId/getConsentHistory',ConsentHistoryModel.getConsentHistory);


module.exports = router; 
