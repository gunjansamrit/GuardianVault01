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

const ConsentHistoryModel = mongoose.model("ConsentHistory", consentHistorySchema);

module.exports = ConsentHistoryModel;
