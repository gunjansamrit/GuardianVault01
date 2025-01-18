const db = require('../dbConnections');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto');

const { generateToken, verifyToken } = require("../utils/jwtToken"); 
const {
  generatePasswordHash,
  verifyPassword,
} = require("../utils/passwordHash"); 
const CredentialModel = require("./credentialModel");
const DataItemModel = require("./dataItemModel");
const {encrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel")

const userSchema = new mongoose.Schema({
  credential_id: { type: mongoose.Schema.Types.ObjectId, ref: "Credential", required: true },
  first_name: { type: String, required: true },
  middle_name: { type: String },
  last_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile_no: { type: String, required: true },
  age: { type: Number, required: true },
  date_of_birth: { type: Date, required: true },
  data_items: [{ type: mongoose.Schema.Types.ObjectId, ref: "DataItem" }],
});


//signup
userSchema.statics.signup = async function (req, res) {
    const userData = req.body;
    const key = process.env.ENCRYPTION_KEY; 
  
    try {
      const hashedPassword = await generatePasswordHash(req.body.password);
  
      const credentialsData = {
        username: userData.username,
        password: hashedPassword,
      };
  
      const existingCredentials = await CredentialModel.findOne({ username: credentialsData.username });
      if (existingCredentials) {
        return res.status(400).send("Username already exists");
      }
  
      const existingUser = await UserModel.findOne({ email: userData.email });

      if (existingUser) {
        return res.status(400).send("Email already exists");
      }
  
      const credentials = await CredentialModel.create(credentialsData);
  
      const newUser = await UserModel.create({
        credential_id: credentials._id,
        first_name: userData.first_name,
        middle_name: userData.middle_name,
        last_name: userData.last_name,
        email: userData.email,
        mobile_no: userData.mobile_no,
        age: userData.age,
        date_of_birth: userData.date_of_birth,
      });
  
      const dataItems = [
        { type: "email", value: userData.email },
        { type: "mobile_no", value: userData.mobile_no },
        { type: "age", value: userData.age.toString() },
        { type: "date_of_birth", value: userData.date_of_birth.toString() },
      ];
  
      const savedDataItems = [];
  
      for (const item of dataItems) {
        const encryptedValue = encrypt(item.value, key);
  
        const dataItem = new DataItemModel({
          item_name: item.type,
          item_owner_id: newUser._id,
        });
  
        const savedItem = await dataItem.save();
  
        savedDataItems.push(savedItem._id);
  
        
        await VaultModel.create({
          encrypted_item_id: encrypt(savedItem._id.toString(), key),
          encrypted_item_value: encryptedValue,
        });
      }
  
      newUser.data_items = savedDataItems;
      await newUser.save();
  
      return res.status(201).send("Registration Successful");
    } catch (error) {
      console.error(error);
      return res.status(500).send("An error occurred during registration");
    }
  };


  //getALLUser
  userSchema.statics.getAllUsers = async function (req, res) {
    try {
      
      const users = await UserModel.find({}, 'first_name last_name _id');
  
     
      if (users.length === 0) {
        return res.status(404).send('No users found');
      }
  
     
      return res.status(200).json(users);
    } catch (error) {
      console.error(error);
      return res.status(500).send('An error occurred while fetching users');
    }
  };

  const UserModel = mongoose.model("User", userSchema);



module.exports = UserModel;
