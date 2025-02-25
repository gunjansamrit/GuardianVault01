const db = require("../dbConnections");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { VaultModel } = require("./vaultModel");
const DataItemModel = require("./dataItemModel");
const { encrypt, decrypt } = require("../utils/encryption");
const ConsentHistoryModel = require("./consentHistoryModel");
const { v4: uuidv4 } = require('uuid');

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

const logConsentHistory = async (consentId, changedBy, previousStatus, newStatus, remarks, additionalInfo) => {
  console.log("Step 1: Logging consent history for consentId:", consentId);
  const historyEntry = await ConsentHistoryModel.create({
    history_id: uuidv4(),
    consent_id: consentId,
    changed_by: changedBy,
    previous_status: previousStatus,
    new_status: newStatus,
    timestamp: new Date(),
    remarks,
    additional_info: additionalInfo,
  });
  console.log("Step 2: Consent history logged:", historyEntry);
};

consentSchema.statics.getApprovedItemsByProvider = async function (req, res) {
  const { provider_id } = req.body;
  const { seeker_id } = req.params;
  console.log("Step 1: Fetching approved items for seeker:", seeker_id, "and provider:", provider_id);

  try {
    const approvedConsents = await ConsentModel.find({
      seeker_id,
      provider_id,
      status: "approved",
      access_count: { $gt: 0 },
    }).select("item_id");
    console.log("Step 2: Found approved consents:", approvedConsents);

    if (!approvedConsents.length) {
      console.log("Step 3: No approved items found.");
      return res.status(404).json({ message: "No approved items found." });
    }

    console.log("Step 4: Sending approved consents:", approvedConsents);
    return res.status(200).json(approvedConsents);
  } catch (error) {
    console.error("Step 5: Error fetching approved items:", error);
    return res.status(500).json({ message: "An error occurred while retrieving approved items." });
  }
};

consentSchema.statics.giveConsent = async function (req, res) {
  const { consent_id, consent, count, validity } = req.body;
  console.log("Step 1: Processing giveConsent for consent_id:", consent_id, "with action:", consent);

  try {
    const consentRequest = await ConsentModel.findById(consent_id);
    console.log("Step 2: Found consent request:", consentRequest);

    if (!consentRequest) {
      console.log("Step 3: Consent request not found.");
      return res.status(404).send("Consent request not found");
    }

    const { item_id, seeker_id, provider_id } = consentRequest;
    const previousStatus = consentRequest.status;
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
    console.log("Step 4: Updated consent request:", consentRequest);

    await logConsentHistory(
      consentRequest._id,
      provider_id.toString(),
      previousStatus,
      updatedStatus,
      `Action: ${consent}`,
      `Seeker: ${seeker_id}, Provider: ${provider_id}, Count: ${count || "N/A"}, Validity: ${validity || "N/A"}`
    );

    console.log("Step 5: Sending response with updated consent:", consentRequest);
    return res.status(200).json({
      message: `Consent has been ${updatedStatus}`,
      consentRequest,
    });
  } catch (error) {
    console.error("Step 6: Error processing consent:", error);
    return res.status(500).send("An error occurred while processing the consent");
  }
};

consentSchema.statics.getConsentListByUserId = async function (req, res) {
  const { userId } = req.params;
  console.log("Step 1: Fetching pending consents for provider userId:", userId);

  try {
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

    const result = consents.map(consent => ({
      consent_id: consent._id,
      item_name: consent.item_id?.item_name || "Unknown Item",
      seeker_name: consent.seeker_id?.name || "Unknown Seeker",
      seeker_email: consent.seeker_id?.email || "N/A",
      status: consent.status,
      date_created: consent.date_created,
    }));
    console.log("Step 3: Formatted consent data:", result);

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
  console.log("Step 1: Accessing item for seeker:", seeker, "item_id:", item_id);

  try {
    const dataItem = await DataItemModel.findById(item_id);
    console.log("Step 2: Found data item:", dataItem);
    if (!dataItem) {
      console.log("Step 3: Item not found in data master.");
      return res.status(404).send("Item not found in the data master.");
    }

    const provider_id = dataItem.item_owner_id;
    const UserModel = require("./userModel");
    const providerUser = await UserModel.findById(provider_id);
    console.log("Step 4: Found provider user:", providerUser);
    if (!providerUser) {
      console.log("Step 5: Provider not found.");
      return res.status(404).send("Provider not found.");
    }

    const userKey = decrypt(providerUser.key, masterKey);
    let consent = await ConsentModel.findOne({ item_id, seeker_id: seeker, provider_id });
    console.log("Step 6: Found consent:", consent);

    if (!consent) {
      consent = await ConsentModel.create({
        item_id,
        seeker_id: seeker,
        provider_id,
        access_count: 1,
        status: "pending",
      });
      console.log("Step 7a: Created new pending consent:", consent);

      await logConsentHistory(
        consent._id,
        seeker.toString(),
        null,
        "pending",
        "New consent request created",
        `Seeker: ${seeker}, Provider: ${provider_id}`
      );

      console.log("Step 8a: Sending pending request response.");
      return res.status(202).json({
        message: "Access request sent.",
        status: "pending"
      });
    }

    const previousStatus = consent.status;

    switch (consent.status) {
      case "rejected":
        console.log("Step 7b: Consent status is rejected.");
        // Do not update to pending here; let frontend handle "Request"
        console.log("Step 8b: Sending rejected notification without update.");
        return res.status(202).json({
          message: "Request was rejected previously by user.",
          status: "rejected"
        });

      case "revoked":
        console.log("Step 7c: Consent status is revoked.");
        console.log("Step 8c: Sending revoked notification without update.");
        return res.status(202).json({
          message: "Request was revoked by user.",
          status: "revoked"
        });

      case "pending":
        console.log("Step 7d: Consent status is pending.");
        console.log("Step 8d: Sending pending notification.");
        return res.status(202).json({
          message: "Request already pending",
          status: "pending"
        });

      case "approved":
        console.log("Step 7e: Consent status is approved.");
        if (new Date() > consent.validity_period) {
          consent.status = "expired";
          await consent.save();
          console.log("Step 8e1: Validity expired, updated consent:", consent);

          await logConsentHistory(
            consent._id,
            "system",
            previousStatus,
            "expired",
            "Validity period exhausted",
            `Seeker: ${seeker}, Provider: ${provider_id}`
          );

          console.log("Step 9e1: Sending expired notification.");
          return res.status(403).json({
            message: "Validity expired",
            status: "expired"
          });
        }

        if (consent.access_count > 0) {
          consent.access_count -= 1;
          if (consent.access_count === 0) {
            consent.status = "count exhausted";
          }
          await consent.save();
          console.log("Step 8e2: Updated consent after access:", consent);

          const encryptedItemId = encrypt(item_id.toString(), userKey);
          const vaultData = await VaultModel.findOne({ encrypted_item_id: encryptedItemId });
          console.log("Step 9e2: Found vault data:", vaultData);
          if (!vaultData) {
            console.log("Step 10e2: Item not found in vault.");
            return res.status(404).send("Item not found in the vault.");
          }

          const decryptedData = decrypt(vaultData.encrypted_item_value, userKey);
          await logConsentHistory(
            consent._id,
            seeker.toString(),
            previousStatus,
            consent.status,
            "Item accessed",
            `Remaining Count: ${consent.access_count}, Seeker: ${seeker}, Provider: ${provider_id}`
          );

          console.log("Step 11e2: Sending approved item data:", decryptedData);
          return res.status(200).json({
            item_name: dataItem.item_name,
            item_value: decryptedData,
            access_count: consent.access_count,
            validity_period: consent.validity_period,
            status: consent.status,
          });
        } else {
          consent.status = "count exhausted";
          await consent.save();
          console.log("Step 8e3: Access count exhausted, updated consent:", consent);

          await logConsentHistory(
            consent._id,
            "system",
            previousStatus,
            "count exhausted",
            "Access count reached zero",
            `Seeker: ${seeker}, Provider: ${provider_id}`
          );

          console.log("Step 9e3: Sending count exhausted notification.");
          return res.status(403).json({
            message: "Count exhausted",
            status: "count exhausted"
          });
        }

      case "expired":
        console.log("Step 7f: Consent status is expired.");
        console.log("Step 8f: Sending expired notification without update.");
        return res.status(202).json({
          message: "Validity expired.",
          status: "expired"
        });

      case "count exhausted":
        console.log("Step 7g: Consent status is count exhausted.");
        console.log("Step 8g: Sending count exhausted notification without update.");
        return res.status(202).json({
          message: "Access count exhausted.",
          status: "count exhausted"
        });

      default:
        console.log("Step 7h: Unknown consent status:", consent.status);
        return res.status(500).send("Invalid consent status");
    }
  } catch (error) {
    console.error("Step 10: Error accessing item:", error);
    return res.status(500).send("An error occurred while processing the access request.");
  }
};

const ConsentModel = mongoose.model("Consent", consentSchema);

module.exports = ConsentModel;