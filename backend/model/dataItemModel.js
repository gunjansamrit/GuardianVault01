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
  

  const DataItemModel = mongoose.model("DataItem", dataItemMasterSchema);
  module.exports = DataItemModel;
