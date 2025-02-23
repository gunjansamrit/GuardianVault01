const db = require("../dbConnections");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { VaultModel } = require("./vaultModel");
const DataItemModel = require("./dataItemModel");
const { encrypt, decrypt } = require("../utils/encryption");
const ConsentHistoryModel = require("./consentHistoryModel");

const consentSchema = new mongoose.Schema({
  item_id: { type: Schema.Types.ObjectId, ref: "DataItem", required: true },
  seeker_id: { type: Schema.Types.ObjectId, ref: "Requestor", required: true },
  provider_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  validity_period: { type: Date, default: new Date(8640000000000000) },
  access_count: { type: Number, required: true, default: 1 },
  status: { 
    type: String, 
    enum: ["pending", "rejected", "approved", "count exhausted", "revoked", "expired"], 
    default: "pending" 
  },
  date_created: { type: Date, default: Date.now },
});

const logConsentHistory = async (consentId, status, additionalInfo) => {
  await ConsentHistoryModel.create({
    consent_id: consentId,
    status,
    requested_at: new Date(),
    additional_info: additionalInfo,
  });
};

consentSchema.statics.getApprovedItemsByProvider = async function (req, res) {
  const { provider_id } = req.body;
  const { seeker_id } = req.params;

  try {
    const approvedConsents = await ConsentModel.find({
      seeker_id,
      provider_id,
      status: "approved",
      access_count: { $gt: 0 },
    }).select("item_id");

    if (!approvedConsents.length) {
      return res.status(404).json({ message: "No approved items found." });
    }

    return res.status(200).json(approvedConsents);
  } catch (error) {
    console.error("Error fetching approved items:", error);
    return res.status(500).json({ message: "An error occurred while retrieving approved items." });
  }
};

consentSchema.statics.giveConsent = async function (req, res) {
  const { consent_id, consent, count, validity } = req.body;

  try {
    const consentRequest = await ConsentModel.findById(consent_id);
    if (!consentRequest) {
      return res.status(404).send("Consent request not found");
    }

    const { item_id, seeker_id, provider_id } = consentRequest;
    let updatedStatus;

    if (consent.toLowerCase() === "yes") {
      updatedStatus = "approved";
      if (count !== undefined) consentRequest.access_count = count;
      if (validity !== undefined) consentRequest.validity_period = validity;
    } else if (consent.toLowerCase() === "revoke") {
      updatedStatus = "revoked";
    } else {
      updatedStatus = "rejected";
    }

    consentRequest.status = updatedStatus;
    await consentRequest.save();

    await logConsentHistory(
      consentRequest._id,
      updatedStatus,
      `Seeker: ${seeker_id}, Provider: ${provider_id}, Count: ${count || "N/A"}, Validity: ${validity || "N/A"}`
    );

    return res.status(200).json({
      message: `Consent has been ${updatedStatus}`,
      consentRequest,
    });
  } catch (error) {
    console.error("Error processing consent:", error);
    return res.status(500).send("An error occurred while processing the consent");
  }
};

consentSchema.statics.getConsentListByUserId = async function (req, res) {
  const { userId } = req.params;
  console.log("Step 1: Fetching pending consents for provider userId:", userId);

  try {
    // Step 2: Query ConsentModel for pending consents
    const consents = await ConsentModel.find({
      provider_id: userId,
      status: "pending",
    })
      .populate({
        path: "item_id",
        select: "item_name",
        model: "DataItem",
      })
      .populate({
        path: "seeker_id",
        select: "name email",
        model: "Requestor",
      });
    console.log("Step 2: Found pending consents after query:", consents);

    // Step 3: Format the result
    const result = consents.map(consent => ({
      consent_id: consent._id,
      item_name: consent.item_id?.item_name || "Unknown Item",
      seeker_name: consent.seeker_id?.name || "Unknown Seeker",
      seeker_email: consent.seeker_id?.email || "N/A",
      status: consent.status,
      date_created: consent.date_created,
    }));
    console.log("Step 3: Formatted consent data:", result);

    // Step 4: Send response
    console.log("Step 4: Sending response with consents:", result);
    return res.status(200).send(result);
  } catch (error) {
    console.error("Step 5: Error fetching consents:", error);
    return res.status(500).send("Error fetching consent list");
  }
};

consentSchema.statics.accessItem = async function (req, res) {
  const { item_id } = req.body;
  const { seeker } = req.params;
  const masterKey = process.env.ENCRYPTION_KEY;

  try {
    const dataItem = await DataItemModel.findById(item_id);
    if (!dataItem) {
      return res.status(404).send("Item not found in the data master.");
    }

    const provider_id = dataItem.item_owner_id;
    const UserModel = require("./userModel");
    const providerUser = await UserModel.findById(provider_id);
    if (!providerUser) {
      return res.status(404).send("Provider not found.");
    }

    const userKey = decrypt(providerUser.key, masterKey);
    let consent = await ConsentModel.findOne({ item_id, seeker_id: seeker, provider_id });

    if (consent) {
      if (consent.status === "approved") {
        if (new Date() > consent.validity_period) {
          return res.status(403).json({ message: "Consent validity period has expired" });
        }

        if (consent.access_count > 0) {
          consent.access_count -= 1;
          if (consent.access_count === 0) {
            consent.status = "count exhausted";
          }
          await consent.save();

          const encryptedItemId = encrypt(item_id.toString(), userKey);
          const vaultData = await VaultModel.findOne({ encrypted_item_id: encryptedItemId });
          if (!vaultData) {
            return res.status(404).send("Item not found in the vault.");
          }

          const decryptedData = decrypt(vaultData.encrypted_item_value, userKey);
          await logConsentHistory(
            consent._id,
            "accessed",
            `Seeker: ${seeker}, Provider: ${provider_id}, Remaining Count: ${consent.access_count}`
          );

          return res.status(200).json({
            item_name: dataItem.item_name,
            item_value: decryptedData,
            access_count: consent.access_count,
            validity_period: consent.validity_period,
            status: consent.status,
          });
        } else {
          return res.status(403).json({ message: "Access count exhausted" });
        }
      } else if (consent.status === "pending") {
        return res.status(202).send("Access request is already pending.");
      } else if (["rejected", "revoked", "count exhausted", "expired"].includes(consent.status)) {
        // Update existing consent to pending for these statuses
        consent.status = "pending";
        consent.access_count = 1;
        consent.validity_period = new Date(8640000000000000);
        await consent.save();
        await logConsentHistory(
          consent._id,
          "requested",
          `Seeker: ${seeker}, Provider: ${provider_id}, Renewed Request`
        );
        return res.status(202).send("Access request renewed.");
      }
    } else {
      // No consent exists, create new
      const newConsent = await ConsentModel.create({
        item_id,
        seeker_id: seeker,
        provider_id,
        access_count: 1,
        status: "pending",
      });
      await logConsentHistory(
        newConsent._id,
        "requested",
        `Seeker: ${seeker}, Provider: ${provider_id}, New Request`
      );
      return res.status(202).send("Access request sent.");
    }
  } catch (error) {
    console.error("Error accessing item:", error);
    return res.status(500).send("An error occurred while processing the access request.");
  }
};

const ConsentModel = mongoose.model("Consent", consentSchema);

module.exports = ConsentModel;