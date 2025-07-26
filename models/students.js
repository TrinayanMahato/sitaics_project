const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  // Serial number
  srNo: {
    type: Number,
    required: true
  },
  
  // Batch number
  batchNo: {
    type: String,
    required: true,
    trim: true
  },
  
  // Rank of the candidate
  rank: {
    type: String,
    required: true,
    trim: true
  },
  
  // Serial number RRU
  serialNumberRRU: {
    type: String,
    required: true,
    trim: true
  },
  
  // Enrollment number
  enrollmentNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Full name of the candidate
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Gender
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female', 'Other']
  },
  
  // Date of birth
  dateOfBirth: {
    type: Date,
    required: true
  },
  
  // Birth place
  birthPlace: {
    type: String,
    required: true,
    trim: true
  },
  
  // Birth state
  birthState: {
    type: String,
    required: true,
    trim: true
  },
  
  // Country
  country: {
    type: String,
    required: true,
    trim: true
  },
  
  // Aadhar number
  aadharNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{12}$/.test(v);
      },
      message: 'Aadhar number must be 12 digits'
    }
  },
  
  // Mobile number
  mobileNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Mobile number must be 10 digits'
    }
  },
  
  // Alternate number
  alternateNumber: {
    type: String,
    required: false,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^\d{10}$/.test(v);
      },
      message: 'Alternate number must be 10 digits if provided'
    }
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
  
  // Address
  address: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'candidates'
});

// Indexes for better query performance
candidateSchema.index({ enrollmentNumber: 1 });
candidateSchema.index({ aadharNo: 1 });
candidateSchema.index({ email: 1 });
candidateSchema.index({ batchNo: 1 });

// Create and export the model
const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = Candidate;