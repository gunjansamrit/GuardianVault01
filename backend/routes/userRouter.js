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
router.post('/:seeker/requestAccess',ConsentModel.requestAccess);
router.post('/login',CredentialModel.login);

module.exports = router; 
