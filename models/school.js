const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  // Name of the school
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Count (could be student count, staff count, etc.)
  count: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  collection: 'schools'
});

// Create and export the model
const School = mongoose.model('School', schoolSchema);

module.exports = School;