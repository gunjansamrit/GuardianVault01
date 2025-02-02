const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto');

const { generateToken, verifyToken } = require("../utils/jwtToken"); 
const {
  generatePasswordHash,
  verifyPassword,
} = require("../utils/passwordHash"); 
const {encrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel");

const requestorSchema = new mongoose.Schema({
  credential_id: { type: mongoose.Schema.Types.ObjectId, ref: "Credential", required: true },

  name: { type: String, required: true, unique: true }, // Name of the requestor (e.g., Bank, Govt Agency)
  type: {
    type: String,
    enum: ["Bank", "Government", "Private Company", "Other"],
    required: true,
  }, // Type of requestor
  registration_no: { type: String, required: true, unique: true }, // Unique registration number
  email: { type: String, required: true, unique: true }, // Contact email
  contact_no: { type: String, required: true }, // Contact number
  address: { type: String, required: true }, // Physical address
  key: { type: String, required: true, immutable: true }, // Unique identifier key for authentication
  created_at: { type: Date, default: Date.now }, // Timestamp of creation
});

// Declare RequestorModel after the schema

// Import CredentialModel after the model is declared
const CredentialModel = require("./credentialModel");

requestorSchema.statics.signup = async function (req, res) {
  const userData = req.body;
  const masterKey = process.env.ENCRYPTION_KEY; 

  try {
    const userKey = userData.key;
    if (!userKey) {
      return res.status(400).send("Encryption key is required");
    }

    const hashedPassword = await generatePasswordHash(req.body.password);

    const credentialsData = {
      username: userData.username,
      password: hashedPassword,
    };

    const existingCredentials = await CredentialModel.findOne({ username: credentialsData.username });
    if (existingCredentials) {
      return res.status(400).send("Username already exists");
    }

    const existingUser = await RequestorModel.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(400).send("Email already exists");
    }

    const credentials = await CredentialModel.create(credentialsData);

    const encryptedUserKey = encrypt(userKey, masterKey);

    const requestorData = {
      name: userData.name,
      type: userData.type,
      registration_no: userData.registration_no,
      email: userData.email,
      contact_no: userData.contact_no,
      address: userData.address,
      key: encryptedUserKey, // Store encrypted key
      credential_id: credentials._id, // Associate with the created credentials
    };

    await RequestorModel.create(requestorData);

    return res.status(201).send("Requestor Registration Successful");

  } catch (error) {
    console.error(error);
    return res.status(500).send("An error occurred during registration");
  }
};

requestorSchema.statics.login = async function (req, res, next) {
    const { username, password } = req.body;
    console.log(username,password);
  
    try {
      
      const credential = await CredentialModel.findOne({ username });
      
      if (!credential) {
        return res.status(404).json({ message: 'User not found' });
      }
  
  
      const isMatch = await verifyPassword(password, credential.password);
      
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid password' });
      }
  
    
      const user = await mongoose.model('Requestor').findOne({ credential_id: credential._id });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const token = generateToken({
        userId: user._id,
        role: 'Requestor', // You can change 'Individual' to any other role if needed
      });
  
      return res.status(200).json({
        message: 'Login successful',
        token: token, // Include the JWT token in the response
        userId: user._id 
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
  };

const RequestorModel = mongoose.model("Requestor", requestorSchema);


module.exports = RequestorModel;
