const mongoose = require("mongoose");

const consentHistorySchema = new mongoose.Schema({
  consent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Consent",
    required: true,
  },
  status: {
    type: String,
    enum: ["requested", "approved", "rejected", "accessed"],
    required: true,
  },
  requested_at: {
    type: Date,
    default: Date.now,
  },
  additional_info: {
    type: String, // For optional details (e.g., count, validity, reason for rejection, etc.)
    default: null,
  },
});

// Static Method
consentHistorySchema.statics.getConsentHistoryByUserId = async function (userId) {
  try {
    // Fetch all consents where the provider_id matches the userId
    const consents = await mongoose
      .model("Consent") // Reference the Consent model
      .find({ provider_id: userId })
      .populate("item_id") // Populate item details (item_name and item_type)
      .populate("seeker_id"); // Populate seeker details (User)

    // Extract all consent IDs from the fetched consents
    const consentIds = consents.map((consent) => consent._id);

    // Fetch consent histories that match the consent IDs
    const consentHistories = await this.find({ consent_id: { $in: consentIds } }).sort({ requested_at: -1 });

    // Map and format the results
    const result = await Promise.all(
      consentHistories.map(async (history) => {
        const consent = consents.find((c) => c._id.equals(history.consent_id));

        if (!consent) return null;

        // Fetch the seeker full name
        const seeker = consent.seeker_id;
        const fullName = `${seeker.first_name} ${seeker.middle_name || ""} ${seeker.last_name}`.trim();

        return {
          consent_id: history.consent_id,
          item_name: consent.item_id.item_name,
          item_type: consent.item_id.item_type,
          seeker_name: fullName,
          status: history.status,
          requested_at: history.requested_at,
          additional_info: history.additional_info,
        };
      })
    );

    return result.filter((item) => item !== null); // Filter out any null entries
  } catch (error) {
    console.error("Error fetching consent history:", error);
    throw new Error("Could not fetch consent history.");
  }
};

const ConsentHistoryModel = mongoose.model("ConsentHistory", consentHistorySchema);

module.exports = ConsentHistoryModel;
