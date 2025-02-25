const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid'); // For UUID generation

const consentHistorySchema = new mongoose.Schema({
  history_id: {
    type: String,
    default: uuidv4, // Use UUID for unique ID
    required: true,
    unique: true,
  },
  consent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Consent",
    required: true,
  },
  changed_by: {
    type: String, // UUID of user or "system"
    required: true,
  },
  previous_status: {
    type: String,
    enum: ["pending", "rejected", "approved", "count exhausted", "revoked", "expired", null], // Null for initial request
    required: false,
  },
  new_status: {
    type: String,
    enum: ["pending", "rejected", "approved", "count exhausted", "revoked", "expired"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  remarks: {
    type: String,
    default: null,
  },
  additional_info: {
    type: String, // For optional details (e.g., count, validity, reason for rejection)
    default: null,
  },
});

// Static method to fetch consent history for a provider
consentHistorySchema.statics.getConsentHistoryByUserId = async (req, res) => {
  const { userId } = req.params;
  console.log("Step 1: Fetching consent history for provider userId:", userId);

  try {
    const consents = await mongoose
      .model("Consent")
      .find({ provider_id: userId })
      .populate("item_id")
      .populate("seeker_id");
    console.log("Step 2: Found consents for provider:", consents);

    const consentIds = consents.map((consent) => consent._id);
    console.log("Step 3: Extracted consent IDs:", consentIds);

    const consentHistories = await mongoose.model("ConsentHistory").find({ consent_id: { $in: consentIds } }).sort({ timestamp: -1 });
    console.log("Step 4: Found consent histories:", consentHistories);

    const result = await Promise.all(
      consentHistories.map(async (history) => {
        const consent = consents.find((c) => c._id.equals(history.consent_id));
        if (!consent) return null;

        const seeker = consent.seeker_id;
        let seekerName = "Unknown Seeker";
        let additionalInfo = history.additional_info || "N/A";

        // Extract seeker_id from additional_info if it exists
        const seekerIdMatch = additionalInfo.match(/Seeker: (\w+)/);
        if (seekerIdMatch && seekerIdMatch[1]) {
          const seekerId = seekerIdMatch[1];
          console.log("Step 5a: Extracted seeker_id from additional_info:", seekerId);

          // Fetch seeker info from Requestor table
          const RequestorModel = mongoose.model("Requestor");
          const seekerInfo = await RequestorModel.findById(seekerId).select("name type email contact_no");
          console.log("Step 5b: Fetched seeker info:", seekerInfo);

          if (seekerInfo) {
            seekerName = seekerInfo.name || "Unknown Seeker";
            additionalInfo = `Name: ${seekerInfo.name}, Type: ${seekerInfo.type}, Email: ${seekerInfo.email}, Contact: ${seekerInfo.contact_no}`;
          } else {
            console.warn("Step 5c: No seeker info found for seeker_id:", seekerId);
            additionalInfo = "Seeker details not found";
          }
        } else {
          console.warn("Step 5d: No seeker_id found in additional_info:", additionalInfo);
        }

        return {
          consent_id: history.consent_id,
          item_name: consent.item_id.item_name,
          item_type: consent.item_id.item_type,
          seeker_name: seekerName, // New field
          status: history.new_status,
          requested_at: history.timestamp,
          additional_info: additionalInfo,
        };
      })
    );
    console.log("Step 5: Formatted history result:", result);

    const filteredResult = result.filter((item) => item !== null);
    console.log("Step 6: Filtered history result:", filteredResult);

    if (filteredResult.length > 0) {
      console.log("Step 7: Sending success response with history:", filteredResult);
      return res.status(200).send({
        success: true,
        data: filteredResult,
      });
    } else {
      console.log("Step 7: No consent history found.");
      return res.status(404).send({
        success: false,
        message: "No consent history found for the given user.",
      });
    }
  } catch (error) {
    console.error("Step 8: Error fetching consent history:", error);
    return res.status(500).send({
      success: false,
      message: "Could not fetch consent history.",
    });
  }
};

// Static method to fetch consent history for a seeker
// Static method to fetch consent history for a seeker
consentHistorySchema.statics.getRequestorConsentHistoryByUserId = async (req, res) => {
  const { userId } = req.params;
  console.log("Step 1: Fetching consent history for seeker userId:", userId);

  try {
    const consents = await mongoose
      .model("Consent")
      .find({ seeker_id: userId })
      .populate("item_id")
      .populate("provider_id"); // Populate provider_id instead of seeker_id
    console.log("Step 2: Found consents for seeker:", consents);

    const consentIds = consents.map((consent) => consent._id);
    console.log("Step 3: Extracted consent IDs:", consentIds);

    const consentHistories = await mongoose
      .model("ConsentHistory")
      .find({ consent_id: { $in: consentIds } })
      .sort({ timestamp: -1 });
    console.log("Step 4: Found consent histories:", consentHistories);

    const result = await Promise.all(
      consentHistories.map(async (history) => {
        const consent = consents.find((c) => c._id.equals(history.consent_id));
        if (!consent) return null;

        const provider = consent.provider_id; // Now populated from User table
        let providerName = "Unknown Provider";
        let additionalInfo = "N/A";

        if (provider) {
          providerName = provider.first_name
            ? `${provider.first_name} ${provider.last_name || ""}`.trim()
            : "Unknown Provider";
          additionalInfo = `Name: ${providerName}, Email: ${provider.email || "N/A"}, Contact: ${
            provider.mobile_no || "N/A"
          }`;
        }

        return {
          consent_id: history.consent_id,
          item_name: consent.item_id.item_name,
          item_type: consent.item_id.item_type,
          provider_name: providerName,
          status: history.new_status,
          requested_at: history.timestamp,
          additional_info: additionalInfo,
        };
      })
    );
    console.log("Step 5: Formatted history result:", result);

    const filteredResult = result.filter((item) => item !== null);
    console.log("Step 6: Filtered history result:", filteredResult);

    if (filteredResult.length > 0) {
      console.log("Step 7: Sending success response with history:", filteredResult);
      return res.status(200).send({
        success: true,
        data: filteredResult,
      });
    } else {
      console.log("Step 7: No consent history found.");
      return res.status(404).send({
        success: false,
        message: "No consent history found for the given user.",
      });
    }
  } catch (error) {
    console.error("Step 8: Error fetching consent history:", error);
    return res.status(500).send({
      success: false,
      message: "Could not fetch consent history.",
    });
  }
};
// Use existing model if already compiled
const ConsentHistoryModel = mongoose.models.ConsentHistory || mongoose.model("ConsentHistory", consentHistorySchema);

module.exports = ConsentHistoryModel;