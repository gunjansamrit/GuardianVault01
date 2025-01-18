const db = require('../dbConnections');
const mongoose = require('mongoose');
const { Schema } = mongoose;

const consentSchema = new mongoose.Schema({
  item_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DataItem', 
    required: true 
  },
 
  seeker_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  provider_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  validity_period: { 
    type: Date, 
    required: true,
    default: Date.MAX_VALUE 
  },
  
  access_count: { 
    type: Number, 
    required: true,
    default: 1 
  },
  
  status: { 
    type: String, 
    enum: ['approved', 'rejected', 'pending'], 
    default: 'pending' 
  },
  
  date_created: { 
    type: Date, 
    default: Date.now 
  }
});

consentSchema.statics.requestAccess = async function(req, res, next) {
  const { seeker_id } = req.params; 
  const { item_id, provider_id } = req.body; 
  
  try {
    
    const newConsent = new this({
      item_id,
      seeker_id,
      provider_id,
      validity_period: Date.MAX_VALUE,  
      access_count: 1,  
    });
    
    
    const savedConsent = await newConsent.save();
    
    return res.status(201).json(savedConsent);
  } catch (error) {
    console.error(error);
    return res.status(500).send('An error occurred while requesting access');
  }
};

const ConsentModel = mongoose.model('Consent', consentSchema);

module.exports = ConsentModel;
