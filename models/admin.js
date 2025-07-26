const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  // Full name of the admin
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Email address
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  
  // Phone number
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Phone number must be 10 digits'
    }
  },
  
  // Password
  password: {
    type: String,
    required: true
  }
}, {
  collection: 'admins'
});

// Create and export the model
const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;