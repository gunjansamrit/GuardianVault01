const db = require("../dbConnections");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { VaultModel, retrieveFromVault } = require("./vaultModel");
const DataItemModel = require("./dataItemModel");

const { encrypt, decrypt } = require("../utils/encryption");

const consentSchema = new mongoose.Schema({
  item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DataItem",
    required: true,
  },

  seeker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  validity_period: {
    type: Date,

    default: Date.MAX_VALUE,
  },

  access_count: {
    type: Number,
    required: true,
    default: 1,
  },

  status: {
    type: String,
    enum: ["approved", "rejected", "pending"],
    default: "pending",
  },

  date_created: {
    type: Date,
    default: Date.now,
  },
});

//requestAccess
consentSchema.statics.requestAccess = async function (req, res, next) {
  const { seeker_id } = req.params;
  const { item_id, provider_id } = req.body;

  try {
    const newConsent = await ConsentModel.create({
      item_id,
      seeker_id,
      provider_id,
      validity_period: Date.MAX_VALUE,
      access_count: 1,
    });

    // Return the newly created consent request
    return res.status(201).json(newConsent);
  } catch (error) {
    console.error(error);
    return res.status(500).send("An error occurred while requesting access");
  }
};

//provideConsent
consentSchema.statics.giveConsent = async function (req, res, next) {
  const { item_id, seeker_id, provider_id, consent } = req.body;

  try {
    const consentRequest = await ConsentModel.findOne({
      item_id,
      seeker_id,
      provider_id,
    });

    if (!consentRequest) {
      return res.status(404).send("Consent request not found");
    }

    const updatedStatus =
      consent.toLowerCase() === "yes" ? "approved" : "rejected";

    consentRequest.status = updatedStatus;
    await consentRequest.save();

    return res.status(200).json({
      message: `Consent has been ${updatedStatus}`,
      consentRequest,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .send("An error occurred while processing the consent");
  }
};

//AccessItems

consentSchema.statics.accessItem = async (req, res) => {
  const { item_id, provider_id } = req.body;
  const { seeker } = req.params;

  const key = process.env.ENCRYPTION_KEY;
  

  try {
    const consent = await ConsentModel.findOne({
      item_id: item_id,
      provider_id: provider_id,
      seeker_id: seeker,
      status: "approved",
    });

    if (!consent) {
      return res.status(403).send("Access denied or consent not found.");
    }

    if (consent.access_count <= 0) {
      return res.status(403).send("Access count exhausted.");
    }

    if (new Date() > consent.validity_period) {
      return res.status(403).send("Consent validity expired.");
    }

    consent.access_count -= 1;
    await consent.save();

   


    const encryptedItemId = encrypt(item_id, key);
    
    const vaultData = await VaultModel.findOne({
      encrypted_item_id: encryptedItemId,
    });

   

    if (!vaultData) {
      return res.status(404).send("Item not found in the vault.");
    }

    const decryptedData = decrypt(vaultData.encrypted_item_value, key);

    const dataItem = await DataItemModel.findById(item_id);

    if (!dataItem) {
      return res.status(404).send("Item not found in the data master.");
    }

   

    return res.status(200).json({
      item_name: dataItem.item_name,
      item_value: decryptedData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("An error occurred while accessing the item.");
  }
};

const ConsentModel = mongoose.model("Consent", consentSchema);

module.exports = ConsentModel;
