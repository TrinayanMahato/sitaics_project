const mongoose = require('mongoose');

const pendingAdminSchema = new mongoose.Schema({
  // Full name of the pending admin
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
  },
  
  // Status of the pending admin (pending, approved, rejected)
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Request date
  requestDate: {
    type: Date,
    default: Date.now
  },
  
  // Approval/rejection date
  processedDate: {
    type: Date,
    default: null
  },
  
  // Notes from admin who processed the request
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  collection: 'pending_admins',
  timestamps: true
});

// Create and export the model
const PendingAdmin = mongoose.model('PendingAdmin', pendingAdminSchema);

module.exports = PendingAdmin;
