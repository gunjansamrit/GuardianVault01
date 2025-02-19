const db = require("../dbConnections");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { generateToken, verifyToken } = require("../utils/jwtToken");
const { generatePasswordHash, verifyPassword } = require("../utils/passwordHash");
const  CredentialModel  = require("./credentialModel");
const {UserBacklogModel} = require("./userBacklog");
const UserModel = require("./userModel");
const DataItemModel = require("./dataItemModel");
const {encrypt,decrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel");
const { RequestorBacklogModel } = require("./requestorBacklog");
const RequestorModel = require("../model/requesterUserModel");




const adminSchema = new Schema({
    credential_id: { type: Schema.Types.ObjectId, ref: "Credential", required: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile_no: { type: String, required: true },
    role: { type: String, enum: ["admin"], default: "admin" }
});



// Admin signup
adminSchema.statics.signup = async function (req, res) {
    const adminData = req.body;
    try {
        // Hash the password
        const hashedPassword = await generatePasswordHash(adminData.password);

        // Check if email already exists
        const existingAdmin = await mongoose.model("Admin").findOne({ email: adminData.email });
        if (existingAdmin) {
            return res.status(400).send("Admin with this email already exists");
        }

        // Create a credential entry
        const credential = await CredentialModel.create({
            username: adminData.username,
            password: hashedPassword,
            role: "admin"
        });

        // Create admin user
        await mongoose.model("Admin").create({
            credential_id: credential._id,
            first_name: adminData.first_name,
            last_name: adminData.last_name,
            email: adminData.email,
            mobile_no: adminData.mobile_no,
            role: "admin"
        });

        return res.status(201).send("Admin registered successfully");
    } catch (error) {
        console.error(error);
        return res.status(500).send("An error occurred during admin registration.");
    }
};

// Admin login
adminSchema.statics.login = async function (req, res) {
    const { username, password } = req.body;
    try {
        const credential = await CredentialModel.findOne({ username, role: "admin" });
        if (!credential) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const isMatch = await verifyPassword(password, credential.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid password" });
        }

        const admin = await mongoose.model("Admin").findOne({ credential_id: credential._id });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const token = generateToken({ userId: admin._id, role: "admin" });
        return res.status(200).json({ message: "Login successful", token, userId: admin._id });//doubt(Rishabh) role is needed
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

adminSchema.statics.getIndividualBackLog = async function (req, res) {
    try {
        const pendingBacklogs = await UserBacklogModel.find({ status: "pending" })
            .sort({ created_at: 1 }) // Ascending order
            .select("-password -key") // Exclude password and key
            .exec();

        return res.status(200).json({ data: pendingBacklogs });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};


adminSchema.statics.getRequestorBackLog = async function (req, res) {
    try {
        const pendingBacklogs = await RequestorBacklogModel.find({ status: "pending" })
            .sort({ created_at: 1 }) // Ascending order
            .select("-password -key") // Exclude password and key
            .exec();

        return res.status(200).json({ data: pendingBacklogs });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};


adminSchema.statics.individualApproval = async function (req, res) {
    try {
        const { userId, action } = req.body;

        if (!userId || !["approve", "reject"].includes(action)) {
            return res.status(400).json({ message: "Invalid request" });
        }

        const userBacklog = await UserBacklogModel.findById(userId);
        if (!userBacklog) {
            return res.status(404).json({ message: "User not found in backlog" });
        }

        if (action === "approve") {
            const masterKey = process.env.ENCRYPTION_KEY;
            console.log(masterKey)

           
            const credentialsData = {
                username: userBacklog.username,
                password: userBacklog.password,
                role : "individual",
            };

            const existingCredentials = await CredentialModel.findOne({ username: credentialsData.username });
            if (existingCredentials) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const existingUser = await UserModel.findOne({ email: userBacklog.email });
            if (existingUser) {
                return res.status(400).json({ message: "Email already exists" });
            }

            const credentials = await CredentialModel.create(credentialsData);


            

            // Encrypt the user key
            const encryptedUserKey = userBacklog.key;

            // Create new user
            const newUser = await UserModel.create({
                credential_id: credentials._id,
                first_name: userBacklog.first_name,
                middle_name: userBacklog.middle_name,
                last_name: userBacklog.last_name,
                email: userBacklog.email,
                mobile_no: userBacklog.mobile_no,
                key: encryptedUserKey,
                date_of_birth: userBacklog.date_of_birth, // Added date_of_birth
                age: userBacklog.age, // Added age
            });

            // Encrypt and store user data in Vault
            const dataItems = [
                { type: "email", value: userBacklog.email },
                { type: "mobile_no", value: userBacklog.mobile_no },
                { type: "age", value: userBacklog.age.toString() },
                { type: "date_of_birth", value: userBacklog.date_of_birth.toString() },
              ];

            const savedDataItems = [];
            const decryptedUserKey = decrypt(userBacklog.key, masterKey);

            for (const item of dataItems) {
                const encryptedValue = encrypt(item.value, decryptedUserKey);

                const dataItem = new DataItemModel({
                    item_name: item.type,
                    item_owner_id: newUser._id,
                });

                const savedItem = await dataItem.save();
                savedDataItems.push(savedItem._id);

                await VaultModel.create({
                    encrypted_item_id: encrypt(savedItem._id.toString(), decryptedUserKey),
                    encrypted_item_value: encryptedValue,
                });
            }

            newUser.data_items = savedDataItems;
            await newUser.save();

            // Mark user as approved in backlog
            userBacklog.status = "approved";
            await userBacklog.save();

            return res.status(200).json({ message: "User approved successfully" });

        } else if (action === "reject") {
            userBacklog.status = "rejected";
            await userBacklog.save();
            return res.status(200).json({ message: "User rejected successfully" });
        }

    } catch (error) {
        console.error("Error in individualApproval:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};


adminSchema.statics.requestorApproval = async function (req, res) {
    try {
        const { userId, action } = req.body;

        // Validate request
        if (!userId || !["approve", "reject"].includes(action)) {
            return res.status(400).json({ message: "Invalid request" });
        }

        // Check if requestor exists in backlog
        const requestorBacklog = await RequestorBacklogModel.findById(userId);
        if (!requestorBacklog) {
            return res.status(404).json({ message: "Requestor not found in backlog" });
        }

        if (action === "approve") {
            const masterKey = process.env.ENCRYPTION_KEY;

            // Check for existing credentials or requestor with the same username or email
            const existingCredentials = await CredentialModel.findOne({ username: requestorBacklog.name });
            if (existingCredentials) {
                return res.status(400).json({ message: "Requestor name already exists" });
            }

            const existingRequestor = await RequestorModel.findOne({ email: requestorBacklog.email });
            if (existingRequestor) {
                return res.status(400).json({ message: "Requestor email already exists" });
            }

            // Create credentials for the requestor
            const credentials = await CredentialModel.create({
                username: requestorBacklog.username,
                password: requestorBacklog.password,
                role: "requestor",
            });

            // Decrypt the user key
            const decryptedUserKey = decrypt(requestorBacklog.key, masterKey);

            // Create new requestor
            const newRequestor = await RequestorModel.create({
                credential_id: credentials._id,
                name: requestorBacklog.name,
                type: requestorBacklog.type,
                registration_no: requestorBacklog.registration_no,
                email: requestorBacklog.email,
                contact_no: requestorBacklog.contact_no,
                address: requestorBacklog.address,
                key: requestorBacklog.key, // Keep the encrypted key
            });

            // Encrypt and store requestor data in Vault
            const dataItems = [
                { type: "email", value: requestorBacklog.email },
                { type: "contact_no", value: requestorBacklog.contact_no },
                { type: "registration_no", value: requestorBacklog.registration_no },
            ];

            const savedDataItems = [];

            for (const item of dataItems) {
                const encryptedValue = encrypt(item.value, decryptedUserKey);

                const dataItem = new DataItemModel({
                    item_name: item.type,
                    item_owner_id: newRequestor._id,
                });

                const savedItem = await dataItem.save();
                savedDataItems.push(savedItem._id);

                await VaultModel.create({
                    encrypted_item_id: encrypt(savedItem._id.toString(), decryptedUserKey),
                    encrypted_item_value: encryptedValue,
                });
            }

            // Associate data items with the new requestor
            newRequestor.data_items = savedDataItems;
            await newRequestor.save();

            // Update backlog status to "approved"
            requestorBacklog.status = "approved";
            await requestorBacklog.save();

            return res.status(200).json({ message: "Requestor approved successfully" });

        } else if (action === "reject") {
            // Update backlog status to "rejected"
            requestorBacklog.status = "rejected";
            await requestorBacklog.save();
            return res.status(200).json({ message: "Requestor rejected successfully" });
        }

    } catch (error) {
        console.error("Error in requestorApproval:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};









// Use existing model if already compiled
const AdminModel = mongoose.models.Admin || mongoose.model("Admin", adminSchema);

module.exports = AdminModel;
