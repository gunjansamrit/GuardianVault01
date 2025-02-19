// requestorBacklog.js
const mongoose = require("mongoose");

const requestorBacklogSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    name: { type: String, required: true, unique: true },
    type: {
        type: String,
        enum: ["Bank", "Government", "Private Company", "Other"],
        required: true,
    },
    registration_no: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    contact_no: { type: String, required: true },
    address: { type: String, required: true },
    key: { type: String, required: true, immutable: true },
    status: {
        type: String,
        enum: ["pending", "rejected", "approved"],
        required: true,
        default: "pending"
    },
    created_at: { type: Date, default: Date.now }
});

const RequestorBacklogModel = mongoose.model("RequestorBacklog", requestorBacklogSchema);
module.exports = { RequestorBacklogModel };