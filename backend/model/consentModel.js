const db = require("../dbConnections");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { VaultModel, retrieveFromVault } = require("./vaultModel");
const DataItemModel = require("./dataItemModel");

const { encrypt, decrypt } = require("../utils/encryption");
const ConsentHistoryModel = require("./consentHistoryModel");

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

    default:  new Date(8640000000000000),
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


//provideConsent
consentSchema.statics.giveConsent = async function (req, res, next) {
    const { consent_id, consent, count, validity } = req.body;
  
    try {
      
      const consentRequest = await ConsentModel.findById(consent_id);
  
      if (!consentRequest) {
        return res.status(404).send("Consent request not found");
      }
  
      const { item_id, seeker_id, provider_id } = consentRequest;
  
      
      const updatedStatus = consent.toLowerCase() === "yes" ? "approved" : "rejected";

      console.log(updatedStatus);
  
      
      consentRequest.status = updatedStatus;
  
      
      if (updatedStatus === "approved") {
        if (count !== undefined) {
          consentRequest.count = count; 
        }
        if (validity !== undefined) {
          consentRequest.validity = validity; 
        }
      }
  
      await consentRequest.save();
  
      
      await ConsentHistoryModel.create({
        consent_id: consentRequest._id,
        status: updatedStatus,
        timestamp: new Date(),
        additional_info: `Count: ${count || "N/A"}, Validity: ${validity || "N/A"}`,
      });
  
      return res.status(200).json({
        message: `Consent has been ${updatedStatus}`,
        consentRequest,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send("An error occurred while processing the consent");
    }
  };

  //getConsentListByUserId 
  // Add the static method to the consentSchema
  consentSchema.statics.getConsentListByUserId = async function (req, res, next) {
    const {userId } = req.params;
    try {
      // Query consents where the user is either a provider or seeker and sort by date_created in descending order
      const consents = await ConsentModel.find({
        $or: [{ provider_id: userId }, { seeker_id: userId }],
      })
        .populate("item_id", "item_name") // Populate the DataItem details (e.g., item_name)
        .populate("seeker_id", "name email") // Populate the seeker details
        .populate("provider_id", "name email") // Populate the provider details
        .sort({ date_created: -1 }); // Sort in descending order of date_created
  
      return res.status(200).send(consents);
    } catch (error) {
      console.error("Error fetching consents:", error);
      throw error;
    }
  };
  
  



  //AccessItems

  consentSchema.statics.accessItem = async (req, res) => {
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

        let consent = await ConsentModel.findOne({
            item_id,
            seeker_id: seeker,
            provider_id,
        });

        const ConsentHistoryModel = require("./consentHistoryModel");
        if (consent) {
            if (consent.status === "approved") {
                if (consent.access_count > 0 && new Date() <= consent.validity_period) {
                    consent.access_count -= 1;
                    await consent.save();

                    const encryptedItemId = encrypt(item_id, userKey);

                    const vaultData = await VaultModel.findOne({
                        encrypted_item_id: encryptedItemId,
                    });

                    if (!vaultData) {
                        return res.status(404).send("Item not found in the vault.");
                    }

                    const decryptedData = decrypt(vaultData.encrypted_item_value, userKey);

                    await ConsentHistoryModel.create({
                        consent_id: consent._id,
                        status: "accessed",
                        accessed_at: new Date(),
                    });

                    return res.status(200).json({
                        item_name: dataItem.item_name,
                        item_value: decryptedData,
                    });
                } else {
                    // If access count is zero or validity expired, create new consent
                    const newConsent = await ConsentModel.create({
                        item_id,
                        seeker_id: seeker,
                        provider_id,
                        access_count: 1,
                        status: "pending",
                    });

                    await ConsentHistoryModel.create({
                        consent_id: newConsent._id,
                        status: "requested",
                        requested_at: new Date(),
                    });

                    return res.status(202).send(
                        "Access count exhausted or consent expired. New access request has been sent to the owner."
                    );
                }
            } else if (consent.status === "pending") {
                return res.status(202).send(
                    "Access request is already pending. Please wait for approval."
                );
            }
        } else {
            // Create new consent if none exists
            const newConsent = await ConsentModel.create({
                item_id,
                seeker_id: seeker,
                provider_id,
                access_count: 1,
                status: "pending",
            });

            await ConsentHistoryModel.create({
                consent_id: newConsent._id,
                status: "requested",
                requested_at: new Date(),
            });

            return res.status(202).send(
                "Access request has been sent to the owner. Please wait for approval."
            );
        }
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .send("An error occurred while processing the access request.");
    }
};
  

const ConsentModel = mongoose.model("Consent", consentSchema);

module.exports = ConsentModel;
