const mongoose = require('mongoose');

const fieldsSchema = new mongoose.Schema({
  // Name of the field
  nameOfTheField: {
    type: String,
    required: true,
    trim: true
  },
  
  // Count associated with the field
  count: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  collection: 'fields'
});

// Create and export the model
const Field = mongoose.model('Field', fieldsSchema);

module.exports = Field;