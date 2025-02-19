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
// const UserBacklogModel = require("./userBacklog");
const {encrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel")


const userSchema = new mongoose.Schema({
    credential_id: { type: mongoose.Schema.Types.ObjectId, ref: "Credential", required: true },
    first_name: { type: String, required: true },
    middle_name: { type: String },
    age: { type: Number, required: true }, // Added age

    last_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    date_of_birth: { type: Date, required: true }, // Added date_of_birth
    mobile_no: { type: String, required: true },
    key: { type: String, required: true, immutable: true },
    data_items: [{ type: mongoose.Schema.Types.ObjectId, ref: "DataItem" }],
});



  


//signup
userSchema.statics.signup = async function (req, res) {
    const userData = req.body;
    const masterKey = process.env.ENCRYPTION_KEY;

    try {
        const userKey = userData.key;
        if (!userKey) {
            return res.status(400).send("Encryption key is required");
        }

        // Hash the password
        const hashedPassword = await generatePasswordHash(userData.password);

        const {UserBacklogModel} = require("./userBacklog")

        // Check if the username already exists in the backlog or main user collection
        const existingUserByUsername = await UserBacklogModel.findOne({ username: userData.username, status: { $ne: "rejected" } });
        const existingUserMain = await mongoose.model('User').findOne({ username: userData.username  });
        if (existingUserByUsername || existingUserMain) {
            return res.status(400).send("Username already exists");
        }

        // Check if the email already exists in the backlog or main user collection
        const existingUserByEmail = await UserBacklogModel.findOne({ 
            email: userData.email, 
            status: { $ne: "rejected" }  // Ignore rejected users
        });        const existingEmailMain = await mongoose.model('User').findOne({ email: userData.email });
        if (existingUserByEmail || existingEmailMain) {
            return res.status(400).send("Email already exists");
        }

        // Encrypt the user key
        const encryptedUserKey = encrypt(userKey, masterKey);

        // Create the user in the backlog
        const newUserBacklog = await UserBacklogModel.create({
            username: userData.username,
            password: hashedPassword,
            role: userData.role,
            first_name: userData.first_name,
            middle_name: userData.middle_name,
            last_name: userData.last_name,
            email: userData.email,
            mobile_no: userData.mobile_no,
            key: encryptedUserKey,
            date_of_birth: userData.date_of_birth, // Added date_of_birth
            age: userData.age, // Added age
            status: "pending", // User remains in backlog until approved
        });

        // Send a JSON response with status and message
        return res.status(201).json({ 
          status: "success", 
          message: "Your registration details have been submitted Succesfully! Waiting for Admin approval..." 
      }); // Changed to JSON

  } catch (error) {
      console.error(error);
      return res.status(500).json({ 
          status: "failed",  // Indicate failure
          message: "An error occurred during registration." 
      }); // Changed to JSON
  }
};
  


  
  userSchema.statics.getAllUsers = async function (req, res) {
    try {
      
      const users = await UserModel.find({}, 'first_name last_name _id');
  
     
      if (users.length === 0) {
        return res.status(404).send('No users found');
      }
  
     console.log(users);
      return res.status(200).json(users);
    } catch (error) {
      console.error(error);
      return res.status(500).send('An error occurred while fetching users');
    }
  };



  
 userSchema.statics.login = async function (req, res, next) {
  const { username, password, role } = req.body;

  try {
    // First check in UserBacklogModel for status
    const {UserBacklogModel} = require("./userBacklog")
    const userBacklog = await UserBacklogModel.findOne({ username });
    
    if (userBacklog) {
      if (userBacklog.status === 'pending') {
        return res.status(450).json({ message: 'Admin is processing your data. We\'ll send you an email soon. Stay connected!', status: 'pending' });
      }
      if (userBacklog.status === 'rejected') {
        return res.status(450).json({ message: 'Your registration has been rejected.', status: 'rejected' });
      }
    }

    // Proceed with the normal login flow
    const credential = await CredentialModel.findOne({ username });

    if (!credential) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (credential.role !== role) {
      return res.status(400).json({ message: 'Invalid role or your role is not valid' });
    }

    const isMatch = await verifyPassword(password, credential.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    const user = await mongoose.model('User').findOne({ credential_id: credential._id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = generateToken({
      userId: user._id,
      role: 'Individual',
    });

    return res.status(200).json({
      message: 'Login successful',
      token: token,
      userId: user._id,
      role: 'provider',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

  const UserModel = mongoose.model("User", userSchema);



module.exports = UserModel;
