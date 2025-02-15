const mongoose = require("mongoose");

const userBacklogSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    first_name: { type: String, required: true },
    middle_name: { type: String },
    last_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    date_of_birth: { type: Date, required: true }, 
    mobile_no: { type: String, required: true },
    age: { type: Number, required: true }, // Added age
    key: { type: String, required: true, immutable: true },
    status: { 
        type: String, 
        enum: ["pending", "rejected", "approved"], 
        required: true, 
        default: "pending"
    },
    created_at: { type: Date, default: Date.now }
});

const UserBacklogModel = mongoose.model("UserBacklog", userBacklogSchema);
module.exports = {UserBacklogModel};
