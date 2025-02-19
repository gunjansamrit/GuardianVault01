const mongoose = require("mongoose");
const { Schema } = mongoose;
const crypto = require("crypto");

const { generateToken, verifyToken } = require("../utils/jwtToken");
const {
  generatePasswordHash,
  verifyPassword,
} = require("../utils/passwordHash");
const { encrypt } = require("../utils/encryption");
const { VaultModel } = require("./vaultModel");

const requestorSchema = new mongoose.Schema({
  credential_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Credential",
    required: true,
  },
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

// Import CredentialModel after the model is declared
const CredentialModel = require("./credentialModel");

//  SIGNUP
requestorSchema.statics.signup = async function (req, res) {
  const userData = req.body;
  console.log(userData);
  const masterKey = process.env.ENCRYPTION_KEY;

  try {
    const userKey = userData.key;
    if (!userKey) {
      return res
        .status(400)
        .json({ status: "failed", message: "Encryption key is required" });
    }

    // Hash the password
    const hashedPassword = await generatePasswordHash(userData.password);

    const { RequestorBacklogModel } = require("./requestorBacklog");

    // Check if the username already exists in credentials, backlog, or main requestor collection
    const existingCredentials = await CredentialModel.findOne({
      username: userData.username,
    });
    const existingRequestorByUsername = await RequestorBacklogModel.findOne({
      name: userData.name,
      status: { $ne: "rejected" },
    });
    const existingRequestorMain = await RequestorModel.findOne({
      name: userData.name,
    });

    if (
      existingCredentials ||
      existingRequestorByUsername ||
      existingRequestorMain
    ) {
      return res
        .status(400)
        .json({
          status: "failed",
          message: "Username or Requestor name already exists",
        });
    }

    // Check if the email already exists in backlog or main requestor collection
    const existingRequestorByEmail = await RequestorBacklogModel.findOne({
      email: userData.email,
      status: { $ne: "rejected" },
    });
    const existingEmailMain = await RequestorModel.findOne({
      email: userData.email,
    });

    if (existingRequestorByEmail || existingEmailMain) {
      return res
        .status(400)
        .json({ status: "failed", message: "Email already exists" });
    }

    // Check if the registration number already exists in backlog or main requestor collection
    const existingRequestorByRegistrationNo =
      await RequestorBacklogModel.findOne({
        registration_no: userData.registration_no,
        status: { $ne: "rejected" },
      });
    const existingRegistrationNoMain = await RequestorModel.findOne({
      registration_no: userData.registration_no,
    });

    if (existingRequestorByRegistrationNo || existingRegistrationNoMain) {
      return res
        .status(400)
        .json({
          status: "failed",
          message: "Registration number already exists",
        });
    }

    // Encrypt the user key
    const encryptedUserKey = encrypt(userKey, masterKey);

    // Create the requestor in the backlog
    const newRequestorBacklog = await RequestorBacklogModel.create({
      username: userData.username,
      password: hashedPassword,
      name: userData.name,
      role: userData.role,
      type: userData.type,
      registration_no: userData.registration_no,
      email: userData.email,
      contact_no: userData.contact_no,
      address: userData.address,
      key: encryptedUserKey,
      status: "pending", // Requestor remains in backlog until approved
    });

    return res.status(201).json({
      status: "success",
      message:
        "Your registration details have been submitted successfully! Waiting for Admin approval...",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "failed",
      message: "An error occurred during registration.",
    });
  }
};

// Login
requestorSchema.statics.login = async function (req, res, next) {
  const { username, password, role } = req.body;
  console.log(username, password);

  try {
    // First check in RequestorBacklogModel for status
    const { RequestorBacklogModel } = require("./requestorBacklog");
    const requestorBacklog = await RequestorBacklogModel.findOne({ username });

    if (requestorBacklog) {
      if (requestorBacklog.status === "pending") {
        return res
          .status(450)
          .json({
            message:
              "Admin is processing your data. We'll send you an email soon. Stay connected!",
            status: "pending",
          });
      }
      if (requestorBacklog.status === "rejected") {
        return res
          .status(450)
          .json({
            message: "Your registration has been rejected.",
            status: "rejected",
          });
      }
    }

    // Proceed with the normal login flow
    const credential = await CredentialModel.findOne({ username });

    if (!credential) {
      return res.status(404).json({ message: "User not found" });
    }

    if (credential.role !== role) {
      return res.status(400).json({ message: 'Invalid role or your role is not valid' });
    }

    const isMatch = await verifyPassword(password, credential.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const user = await mongoose
      .model("Requestor")
      .findOne({ credential_id: credential._id });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = generateToken({
      userId: user._id,
      role: "Requestor", // You can change 'Individual' to any other role if needed
    });

    return res.status(200).json({
      message: "Login successful",
      token: token, // Include the JWT token in the response
      userId: user._id,
      role: "requestor", // You can change 'Individual' to any other role if needed
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const RequestorModel = mongoose.model("Requestor", requestorSchema);

module.exports = RequestorModel;
