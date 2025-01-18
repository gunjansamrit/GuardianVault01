const mongoose = require('mongoose');
const db=require('../dbConnections');
const {encrypt ,decrypt} = require("../utils/encryption");



const vaultSchema = new mongoose.Schema({
    encrypted_item_id: { type: String, required: true }, 
    encrypted_item_value: { type: String, required: true }, 
});

async function storeInVault(itemId, itemValue, key) {
    const encryptedItemId = encrypt(itemId, key);
    const encryptedItemValue = encrypt(itemValue, key);

    const vaultEntry = new VaultModel({
        encrypted_item_id: encryptedItemId,
        encrypted_item_value: encryptedItemValue,
    });

    await vaultEntry.save();
    console.log("Data stored successfully in the vault!");
}

async function retrieveFromVault(encryptedItemId, key) {
    const vaultEntry = await VaultModel.findOne({ encrypted_item_id: encryptedItemId });
    if (!vaultEntry) {
        throw new Error("Item not found in the vault!");
    }

    const decryptedItemId = decrypt(vaultEntry.encrypted_item_id, key);
    const decryptedItemValue = decrypt(vaultEntry.encrypted_item_value, key);

    return { decryptedItemId, decryptedItemValue };
}

const VaultModel = mongoose.model("Vault", vaultSchema);

module.exports = { VaultModel, storeInVault, retrieveFromVault };
