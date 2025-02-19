const express = require("express");
const router = express.Router();
const userModel = require("../model/userModel");
const DataItemModel = require("../model/dataItemModel");
const ConsentModel = require("../model/consentModel");
const CredentialModel = require("../model/credentialModel");
const ConsentHistoryModel = require("../model/consentHistoryModel");
const  RequestorModel = require("../model/requesterUserModel");


router.post('/signup', RequestorModel.signup);
router.post('/login',RequestorModel.login);
// router.post('/findUserIdByUsername',CredentialModel.findUserIdByUsername);
router.get('/:userId/getItemMetaDetailsByUser',DataItemModel.getItemMetaDetailsByUser);
// router.post('/:seeker/accessItem',ConsentModel.accessItem);
router.post('/:seeker/getApprovedItemsByProvider',ConsentModel.getApprovedItemsByProvider);
// router.get('/:userId/getRequestorConsentHistoryByUserId',ConsentHistoryModel.getRequestorConsentHistoryByUserId);


module.exports = router; 
