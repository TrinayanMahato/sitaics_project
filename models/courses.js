const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  // Unique identifier for the course
  ID: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Name of the course
  Name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Eligible departments for the course
  eligibleDepartments: {
    type: [String],
    required: true,
    validate: {
      validator: function(departments) {
        return departments && departments.length > 0;
      },
      message: 'At least one eligible department must be specified'
    }
  },
  
  // Course start date
  startDate: {
    type: Date,
    required: true
  },
  
  // Course end date
  endDate: {
    type: Date,
    required: true
  },
  
  // Course completion status
  completed: {
    type: String,
    required: true,
    enum: ['no', 'yes'],
    default: 'no'
  },
  
  // Field of the course
  field: {
    type: String,
    required: true,
    trim: true
  }
}, {
  collection: 'courses'
});

// Index for the unique ID field
courseSchema.index({ ID: 1 });

// Pre-save middleware to validate dates and update completion status
courseSchema.pre('save', function(next) {
  if (this.startDate >= this.endDate) {
    next(new Error('End date must be after start date'));
  } else {
    // Auto-update completion status based on current date
    const currentDate = new Date();
    if (currentDate > this.endDate) {
      this.completed = 'yes';
    }
    next();
  }
});

// Create and export the model
const Course = mongoose.model('Course', courseSchema);

module.exports = Course;