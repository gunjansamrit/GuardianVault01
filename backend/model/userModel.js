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
const {encrypt, decrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel");

const userSchema = new mongoose.Schema({
    credential_id: { type: mongoose.Schema.Types.ObjectId, ref: "Credential", required: true },
    first_name: { type: String, required: true },
    middle_name: { type: String },
    age: { type: Number, required: true },
    last_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    date_of_birth: { type: Date, required: true },
    mobile_no: { type: String, required: true },
    key: { type: String, required: true, immutable: true },
    data_items: [{ type: mongoose.Schema.Types.ObjectId, ref: "DataItem" }],
});

// signup, getAllUsers, login methods remain unchanged
userSchema.statics.signup = async function (req, res) {
    const userData = req.body;
    const masterKey = process.env.ENCRYPTION_KEY;

    try {
        const userKey = userData.key;
        if (!userKey) {
            return res.status(400).send("Encryption key is required");
        }

        const hashedPassword = await generatePasswordHash(userData.password);
        const {UserBacklogModel} = require("./userBacklog");

        const existingUserByUsername = await UserBacklogModel.findOne({ 
            username: userData.username, 
            status: { $ne: "rejected" } 
        });
        if (existingUserByUsername) {
            return res.status(400).send("Username already exists");
        }

        const existingUserByEmail = await UserBacklogModel.findOne({ 
            email: userData.email, 
            status: { $ne: "rejected" }
        });
        const existingEmailMain = await UserModel.findOne({ 
            email: userData.email 
        });
        if (existingUserByEmail || existingEmailMain) {
            return res.status(400).send("Email already exists");
        }

        const encryptedUserKey = encrypt(userKey, masterKey);
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
            date_of_birth: userData.date_of_birth,
            age: userData.age,
            status: "pending",
        });

        return res.status(201).json({ 
            status: "success", 
            message: "Your registration details have been submitted Successfully! Waiting for Admin approval..." 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            status: "failed",
            message: "An error occurred during registration." 
        });
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
        const {UserBacklogModel} = require("./userBacklog");
        const userBacklog = await UserBacklogModel.findOne({ username });
        
        if (userBacklog) {
            if (userBacklog.status === 'pending') {
                return res.status(450).json({ 
                    message: 'Admin is processing your data. We\'ll send you an email soon. Stay connected!', 
                    status: 'pending' 
                });
            }
            if (userBacklog.status === 'rejected') {
                return res.status(450).json({ 
                    message: 'Your registration has been rejected.', 
                    status: 'rejected' 
                });
            }
        }

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

        const user = await UserModel.findOne({ 
            credential_id: credential._id 
        });
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

// Updated checkAndProcessConsent method
userSchema.statics.checkAndProcessConsent = async function (req, res) {
    const { providerName, seekerName } = req.body;
    const masterKey = process.env.ENCRYPTION_KEY;
    const ConsentModel = require("./consentModel");
    const RequestorModel = require("./requesterUserModel");

    console.log("checkAndProcessConsent", providerName, seekerName);

    try {
        const providerCredential = await CredentialModel.findOne({ 
            username: providerName,
            role: "individual"
        });
        
        const seekerCredential = await CredentialModel.findOne({ 
            username: seekerName,
            role: "requestor"
        });

        if (!providerCredential || !seekerCredential) {
            return res.status(404).json({ 
                message: "Provider or Seeker not found or invalid role" 
            });
        }

        console.log("step 1 done");

        const providerUser = await UserModel.findOne({ 
            credential_id: providerCredential._id 
        });
        
        const seekerUser = await RequestorModel.findOne({ 
            credential_id: seekerCredential._id 
        });

        if (!providerUser || !seekerUser) {
            return res.status(404).json({ 
                message: "User or Requestor records not found" 
            });
        }

        console.log("step 2 done");

        const publicUserData = {
            userId: providerUser._id,
            firstName: providerUser.first_name,
            middleName: providerUser.middle_name || "",
            lastName: providerUser.last_name,
            email: providerUser.email,
            mobileNo: providerUser.mobile_no,
            age: providerUser.age,
            dateOfBirth: providerUser.date_of_birth,
            image: "https://plus.unsplash.com/premium_photo-1689568126014-06fea9d5d341?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        };

        console.log("public data prepared");

        const dataItems = await DataItemModel.find({ 
            item_owner_id: providerUser._id 
        }, 'item_name _id');

        console.log("step 3 done");

        const validConsentItems = [];
        const pendingConsentItems = [];

        if (dataItems.length > 0) {
            const decryptedUserKey = decrypt(providerUser.key, masterKey);

            for (const item of dataItems) {
                const consent = await ConsentModel.findOne({
                    item_id: item._id,
                    seeker_id: seekerUser._id,
                    provider_id: providerUser._id
                });

                if (consent && consent.status === "approved" && 
                    consent.access_count > 0 && 
                    new Date() <= consent.validity_period) { // Check expiration but don't update status
                    const encryptedItemId = encrypt(item._id.toString(), decryptedUserKey);
                    const vaultData = await VaultModel.findOne({ 
                        encrypted_item_id: encryptedItemId 
                    });

                    if (vaultData) {
                        const decryptedValue = decrypt(vaultData.encrypted_item_value, decryptedUserKey);
                        validConsentItems.push({
                            itemId: item._id,
                            itemName: item.item_name,
                            itemValue: decryptedValue,
                            accessCount: consent.access_count,
                            validityPeriod: consent.validity_period,
                            status: "approved"
                        });
                    }
                } else {
                    pendingConsentItems.push({
                        itemId: item._id,
                        itemName: item.item_name,
                        status: consent ? consent.status : "no_consent"
                    });
                }
            }
        }

        console.log("step 4 & 5 done");

        return res.status(200).json({
            publicData: publicUserData,
            validItems: validConsentItems,
            pendingItems: pendingConsentItems,
            message: "Items and user data processed successfully"
        });

    } catch (error) {
        console.error("Error processing consent:", error);
        console.log("Error processing consent:", error);
        return res.status(500).json({ 
            message: "Server error occurred while processing request",
            error: error.message
        });
    }
};

userSchema.statics.getUserData = async function (req, res) {
    const { userId } = req.params;
    try {
        const user = await UserModel.findById(userId).select('-key -credential_id');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
            email: user.email,
            mobile_no: user.mobile_no,
            age: user.age,
            date_of_birth: user.date_of_birth
        });
    } catch (error) {
        console.error("Error fetching user data:", error);
        return res.status(500).json({ 
            message: "Server error occurred while fetching user data",
            error: error.message
        });
    }
};

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;