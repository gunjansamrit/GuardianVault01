const db=require('../dbConnections')
const mongoose = require('mongoose');
const { Schema } = mongoose;
const {encrypt} = require("../utils/encryption");
const {VaultModel} = require("./vaultModel")

const dataItemMasterSchema = new mongoose.Schema({
    item_type: { 
      type: String, 
      enum: ['file', 'record'], // Allowed values
      default: 'record', // Default value
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

  dataItemMasterSchema.statics.getItemsByUserId = async (req, res, next) =>  {

    const { userId } = req.params;
    console.log(userId);
    try {
      
      const items = await DataItemModel.find({ item_owner_id: userId }, 'item_type item_name');
  
      
      if (items.length === 0) {
        return res.status(404).send('No items found for this user');
      }
    
      console.log(items);
      return res.status(200).json(items);
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
