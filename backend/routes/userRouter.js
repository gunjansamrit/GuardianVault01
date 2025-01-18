const express = require("express");
const router = express.Router();
const userModel = require("../model/userModel");
const DataItemModel = require("../model/dataItemModel");
const ConsentModel = require("../model/consentModel");
const CredentialModel = require("../model/credentialModel");

router.post('/signup', userModel.signup);
router.get('/getAllUsers',userModel.getAllUsers);
router.get('/:userId/getItems',DataItemModel.getItemsByUserId);
router.post('/:userId/addItems',DataItemModel.addItem);
router.post('/:seeker_id/requestAccess',ConsentModel.requestAccess);
router.post('/login',CredentialModel.login);
router.post('/giveConsent',ConsentModel.giveConsent);
router.post('/:seeker/accessItem',ConsentModel.accessItem);


module.exports = router; 
