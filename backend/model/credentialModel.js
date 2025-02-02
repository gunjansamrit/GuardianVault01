const db = require('../dbConnections');
const mongoose = require('mongoose');

const { Schema } = mongoose;
const {
    generatePasswordHash,
    verifyPassword,
  } = require("../utils/passwordHash");

const credentialSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});


credentialSchema.statics.findUserIdByUsername = async function (req, res) {
    const { username } = req.body; // Get the username from the request body
    console.log(username)
  
    try {
      // Find the credential record by username
      const credential = await CredentialModel.findOne({ username });
  
      if (!credential) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Find the user associated with the credential
      const user = await mongoose.model('User').findOne({ credential_id: credential._id });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Send the userId as the response
      return res.status(200).json({ userId: user._id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
  };

const CredentialModel = mongoose.model('Credential', credentialSchema);

module.exports = CredentialModel;
