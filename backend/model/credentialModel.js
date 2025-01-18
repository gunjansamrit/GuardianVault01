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

credentialSchema.statics.login = async function (req, res, next) {
  const { username, password } = req.body;

  try {
    
    const credential = await CredentialModel.findOne({ username });
    
    if (!credential) {
      return res.status(404).json({ message: 'User not found' });
    }


    const isMatch = await verifyPassword(password, credential.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

  
    const user = await mongoose.model('User').findOne({ credential_id: credential._id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    
    return res.status(200).json({ userId: user._id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const CredentialModel = mongoose.model('Credential', credentialSchema);

module.exports = CredentialModel;
