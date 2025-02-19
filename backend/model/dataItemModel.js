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
    const { userId } = req.params; 
    
    try {
      
      const  UserModel = require("./userModel")
      const user = await UserModel.findOne({ _id: userId });
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      
      const encryptedUserKey = user.key;
      if (!encryptedUserKey) {
        return res.status(400).send('User encryption key not found');
      }
  
      
      const masterKey = process.env.ENCRYPTION_KEY;
      const decryptedUserKey = decrypt(encryptedUserKey, masterKey);
  
  
      const items = await DataItemModel.find(
        { item_owner_id: userId },
        'item_type item_name _id' 
      );
  
      if (items.length === 0) {
        return res.status(404).send('No items found for this user');
      }
  
      const updatedItems = [];
  
      
      for (let item of items) {
       
        const encryptedItemId = encrypt(item._id.toString(), decryptedUserKey);
  
        
        const vaultData = await VaultModel.findOne({ encrypted_item_id: encryptedItemId });
        if (!vaultData) {
          console.log(`Vault data not found for item_id: ${item._id}`);
          continue;
        }
  
       
        const decryptedItemValue = decrypt(vaultData.encrypted_item_value, decryptedUserKey);
  
       
        updatedItems.push({
          item_id: item._id,
          item_value: decryptedItemValue,
          item_type: item.item_type,
          item_name: item.item_name,
        });
      }
  
     
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
      
      const  UserModel = require("./userModel")
      const user = await UserModel.findOne({ _id: userId });
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      const encryptedUserKey = user.key; 
      if (!encryptedUserKey) {
        return res.status(400).send('User encryption key not found');
      }
  
      
      const masterKey = process.env.ENCRYPTION_KEY;
      const decryptedUserKey = decrypt(encryptedUserKey, masterKey);  
  
      
      const encryptedValue = encrypt(item_value, decryptedUserKey); 
  
      
      const dataItem = new DataItemModel({
        item_name,
        item_owner_id: userId,  
      });
  
      const savedItem = await dataItem.save();
  
     
      await VaultModel.create({
        encrypted_item_id: encrypt(savedItem._id.toString(), decryptedUserKey), 
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


  // Update Items
  dataItemMasterSchema.statics.updateItem = async (req, res) => {
    const { userId } = req.params;
    const { itemId, item_name, item_value } = req.body;

    if (!itemId || !item_name || !item_value) {
      return res.status(400).send('Item ID, name, and value are required for updating.');
    }

    try {
      // Find the user first
      const UserModel = require("./userModel");
      const user = await UserModel.findOne({ _id: userId });
      if (!user) {
        return res.status(404).send('User not found');
      }

      const encryptedUserKey = user.key;
      if (!encryptedUserKey) {
        return res.status(400).send('User encryption key not found');
      }

      const masterKey = process.env.ENCRYPTION_KEY;
      const decryptedUserKey = decrypt(encryptedUserKey, masterKey);

      // Find the item in DataItemModel
      const item = await DataItemModel.findOne({ _id: itemId, item_owner_id: userId });
      if (!item) {
        return res.status(404).send('Item not found or does not belong to this user');
      }

      // Update item name in DataItemModel
      item.item_name = item_name;
      await item.save();

      // Update in VaultModel
      const encryptedItemId = encrypt(item._id.toString(), decryptedUserKey);
      const encryptedValue = encrypt(item_value, decryptedUserKey);

      const vaultUpdateResult = await VaultModel.updateOne(
        { encrypted_item_id: encryptedItemId },
        { encrypted_item_value: encryptedValue }
      );

      if (vaultUpdateResult.nModified === 0) {
        console.warn(`No vault data updated for item_id: ${item._id}`);
        // If no vault data was found, you might want to create one here or handle this scenario differently
        await VaultModel.create({
          encrypted_item_id: encryptedItemId,
          encrypted_item_value: encryptedValue
        });
      }

      return res.status(200).json({
        message: 'Item updated successfully',
        itemId: itemId,
        item_name: item_name
      });
    } catch (error) {
      console.error("Error updating item:", error);
      return res.status(500).send('An error occurred while updating the item');
    }
  };

  

//Delete Items
  dataItemMasterSchema.statics.deleteItem = async (req, res) => {
    const { userId } = req.params;
    const { itemId } = req.body; // Assuming the item ID to delete is sent in the request body
  
    console.log("userId",userId);
    console.log("itemId",itemId);

    if (!itemId) {
      return res.status(400).send('Item ID is required for deletion.');
    }
  
    try {
      // Find the user first
      const UserModel = require("./userModel");
      const user = await UserModel.findOne({ _id: userId });
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      const encryptedUserKey = user.key;
      if (!encryptedUserKey) {
        return res.status(400).send('User encryption key not found');
      }
  
      const masterKey = process.env.ENCRYPTION_KEY;
      const decryptedUserKey = decrypt(encryptedUserKey, masterKey);
  
      // Find the item in DataItemModel
      const item = await DataItemModel.findOne({ _id: itemId, item_owner_id: userId });
      if (!item) {
        return res.status(404).send('Item not found or does not belong to this user');
      }
  
      // Delete from VaultModel first since we need the encrypted_item_id
      const encryptedItemId = encrypt(item._id.toString(), decryptedUserKey);
      const vaultDeletion = await VaultModel.deleteOne({ encrypted_item_id: encryptedItemId });
      if (vaultDeletion.deletedCount === 0) {
        console.warn(`No vault data found for item_id: ${item._id}`);
      }
  
      // Delete the item from DataItemModel
      const itemDeletion = await DataItemModel.deleteOne({ _id: itemId });
      
      if (itemDeletion.deletedCount === 0) {
        return res.status(500).send('Item deletion failed');
      }
  
      return res.status(200).json({
        message: 'Item deleted successfully',
        itemId: itemId
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send('An error occurred while deleting the item');
    }
  };



  //getMetadata BY userID
  dataItemMasterSchema.statics.getItemMetaDetailsByUser = async (req, res) => {
    const { userId } = req.params; 
    console.log("userId",userId);

    try {
        const items = await DataItemModel.find({ item_owner_id: userId }, {});
        return res.status(200).json(items);
    } catch (error) {
        console.error("Error fetching item details for user:", error);
        return res.status(500).json({ message: "Failed to fetch item details for the specified user" });
    }
};
  

  const DataItemModel = mongoose.model("DataItem", dataItemMasterSchema);
  module.exports = DataItemModel;
