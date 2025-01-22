const db=require('../dbConnections')
const mongoose = require('mongoose');
const { Schema } = mongoose;
const {encrypt,decrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel")


const dataItemMasterSchema = new mongoose.Schema({
    item_type: { 
      type: String, 
      enum: ['file', 'record'], 
      default: 'record', 
    },
    item_name: { 
      type: String, 
      required: true 
    },
    item_owner_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
  });

 

  dataItemMasterSchema.statics.getItemsByUserId = async (req, res, next) => {
    const { userId } = req.params; // Extract the userId from request params
    
    try {
      // Fetch the user document
      const  UserModel = require("./userModel")
      const user = await UserModel.findOne({ _id: userId });
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // Retrieve the encrypted user key
      const encryptedUserKey = user.key;
      if (!encryptedUserKey) {
        return res.status(400).send('User encryption key not found');
      }
  
      // Decrypt the user key using the master key from environment variables
      const masterKey = process.env.ENCRYPTION_KEY;
      const decryptedUserKey = decrypt(encryptedUserKey, masterKey);
  
      // Fetch all data items associated with the user
      const items = await DataItemModel.find(
        { item_owner_id: userId },
        'item_type item_name _id' // Select necessary fields only
      );
  
      if (items.length === 0) {
        return res.status(404).send('No items found for this user');
      }
  
      const updatedItems = [];
  
      // Iterate over the items to fetch and decrypt vault data
      for (let item of items) {
        // Encrypt the item ID with the decrypted user key
        const encryptedItemId = encrypt(item._id.toString(), decryptedUserKey);
  
        // Fetch the corresponding vault data
        const vaultData = await VaultModel.findOne({ encrypted_item_id: encryptedItemId });
        if (!vaultData) {
          console.log(`Vault data not found for item_id: ${item._id}`);
          continue;
        }
  
        // Decrypt the item value using the decrypted user key
        const decryptedItemValue = decrypt(vaultData.encrypted_item_value, decryptedUserKey);
  
        // Add the decrypted item to the result list
        updatedItems.push({
          item_id: item._id,
          item_value: decryptedItemValue,
          item_type: item.item_type,
          item_name: item.item_name,
        });
      }
  
      // Check if any items were successfully decrypted
      if (updatedItems.length === 0) {
        return res.status(404).send('No items found in vault or decryption failed');
      }
  
      
      return res.status(200).json(updatedItems);
    } catch (error) {
      console.error(error);
      return res.status(500).send('An error occurred while fetching items');
    }
  };
  

  //addItems

  dataItemMasterSchema.statics.addItem = async (req, res) => {
    const { userId } = req.params; 
    const { item_name, item_value } = req.body; 
  
    if (!item_name || !item_value) {
      return res.status(400).send('Item name and value are required.');
    }
  
    try {
     
      const key = process.env.ENCRYPTION_KEY; 
      const encryptedValue = encrypt(item_value, key);
  
     
      const dataItem = new DataItemModel({
        item_name,
        item_owner_id: userId, 
      });
  
   
      const savedItem = await dataItem.save();
  
      
      await VaultModel.create({
        encrypted_item_id: encrypt(savedItem._id.toString(), key),
        encrypted_item_value: encryptedValue,
      });
  

      return res.status(201).json({
        message: 'Item added successfully',
        item_id: savedItem._id,
        item_name: savedItem.item_name,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send('An error occurred while adding the item');
    }
  };

  const DataItemModel = mongoose.model("DataItem", dataItemMasterSchema);
  module.exports = DataItemModel;
