const mongoose = require('mongoose');

const mouSchema = new mongoose.Schema({
  // Unique identifier for the MOU
  ID: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Name of the partner institution
  nameOfPartnerInstitution: {
    type: String,
    required: true,
    trim: true
  },
  
  // Strategic area covered by the MOU
  strategicAreas: {
    type: String,
    required: true,
    trim: true
  }
}, {
  collection: 'mous'
});

// Index for the unique ID field
mouSchema.index({ ID: 1 });

// Create and export the model
const MOU = mongoose.model('MOU', mouSchema);

module.exports = MOU;