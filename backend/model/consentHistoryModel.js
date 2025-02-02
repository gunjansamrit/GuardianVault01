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
consentHistorySchema.statics.getConsentHistoryByUserId = async (req, res) =>  {
    const { userId } = req.params;
    
    try {
      
      const consents = await mongoose
        .model("Consent") 
        .find({ provider_id: userId })
        .populate("item_id") 
        .populate("seeker_id"); 
  
     
      const consentIds = consents.map((consent) => consent._id);
  
      
      const consentHistories = await ConsentHistoryModel.find({ consent_id: { $in: consentIds } }).sort({ requested_at: -1 });
  
      
      const result = await Promise.all(
        consentHistories.map(async (history) => {
          const consent = consents.find((c) => c._id.equals(history.consent_id));
  
          if (!consent) return null;
  
          
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
  
      
      const filteredResult = result.filter((item) => item !== null);
  
      if (filteredResult.length > 0) {
        return res.status(200).send({
          success: true,
          data: filteredResult,
        });
      } else {
        return res.status(404).send({
          success: false,
          message: "No consent history found for the given user.",
        });
      }
    } catch (error) {
      console.error("Error fetching consent history:", error);
      return res.status(500).send({
        success: false,
        message: "Could not fetch consent history.",
      });
    }
  };

  consentHistorySchema.statics.getRequestorConsentHistoryByUserId = async (req, res) =>  {
    const { userId } = req.params;
    
    try {
      
      const consents = await mongoose
        .model("Consent") 
        .find({ seeker_id: userId })
        .populate("item_id") 
        .populate("seeker_id"); 
  
     
      const consentIds = consents.map((consent) => consent._id);
  
      
      const consentHistories = await ConsentHistoryModel.find({ consent_id: { $in: consentIds } }).sort({ requested_at: -1 });
  
      
      const result = await Promise.all(
        consentHistories.map(async (history) => {
          const consent = consents.find((c) => c._id.equals(history.consent_id));
  
          if (!consent) return null;
  
          
          const provider = consent.provider_id;
        //   const fullName = `${provider.first_name} ${provider.middle_name || ""} ${provider.last_name}`.trim();
  
          return {
            consent_id: history.consent_id,
            item_name: consent.item_id.item_name,
            item_type: consent.item_id.item_type,
            provider_name: provider.name ,
            status: history.status,
            requested_at: history.requested_at,
           
          };
        })
      );
  
      
      const filteredResult = result.filter((item) => item !== null);
  
      if (filteredResult.length > 0) {
        return res.status(200).send({
          success: true,
          data: filteredResult,
        });
      } else {
        return res.status(404).send({
          success: false,
          message: "No consent history found for the given user.",
        });
      }
    } catch (error) {
      console.error("Error fetching consent history:", error);
      return res.status(500).send({
        success: false,
        message: "Could not fetch consent history.",
      });
    }
  };


  


const ConsentHistoryModel = mongoose.model("ConsentHistory", consentHistorySchema);

module.exports = ConsentHistoryModel;
