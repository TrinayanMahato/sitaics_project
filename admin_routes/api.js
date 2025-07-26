const express = require('express');
const mongoose = require('mongoose');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/sispa', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Import MOU schema
const MOU = require('./models/MOU');
const Course = require('./models/Course');
const School = require('./models/School');

// Route to get all MOUs information
app.get('/api/mous', async (req, res) => {
  try {
    const mous = await MOU.find();
    res.json({
      success: true,
      count: mous.length,
      data: mous
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route to get all currently running courses (completed = "no")
app.get('/api/courses/running', async (req, res) => {
  try {
    const runningCourses = await Course.find({ completed: "no" });
    res.json({
      success: true,
      count: runningCourses.length,
      data: runningCourses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route to get all schools with count > 0 as links
app.get('/api/schools/active', async (req, res) => {
  try {
    const activeSchools = await School.find({ count: { $gt: 0 } });
    
    // Transform schools into link format for frontend
    const schoolLinks = activeSchools.map(school => ({
      id: school._id,
      name: school.name,
      count: school.count,
      link: `/api/schools/${school._id}` // Link that will hit another route when clicked
    }));

    res.json({
      success: true,
      count: schoolLinks.length,
      data: schoolLinks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



// Route that will be hit when admin clicks on school link
app.get('/api/schools/:schoolId', async (req, res) => {
  try {
    const schoolId = req.params.schoolId;
    
    // Find all MOUs that belong to this school
    const schoolMOUs = await MOU.find({ nameOfPartnerInstitution: schoolId });
    
    res.json({
      success: true,
      schoolId: schoolId,
      count: schoolMOUs.length,
      data: schoolMOUs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Route to get all completed courses (completed = "yes")
app.get('/api/courses/completed', async (req, res) => {
  try {
    const completedCourses = await Course.find({ completed: "yes" });
    
    res.json({
      success: true,
      count: completedCourses.length,
      data: completedCourses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route to get all fields as links
app.get('/api/fields', async (req, res) => {
  try {
    const allFields = await Field.find();
    
    // Transform fields into link format for frontend
    const fieldLinks = allFields.map(field => ({
      id: field._id,
      nameOfTheField: field.nameOfTheField,
      count: field.count,
      link: `/api/fields/${field._id}` // Link that will hit another route when clicked
    }));

    res.json({
      success: true,
      count: fieldLinks.length,
      data: fieldLinks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Route that will be hit when admin clicks on field link
app.get('/api/fields/:fieldId', async (req, res) => {
  try {
    const fieldId = req.params.fieldId;
    
    // First retrieve the field
    const field = await Field.findById(fieldId);
    
    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }
    
    // Then retrieve all courses of this field
    const fieldCourses = await Course.find({ field: field.nameOfTheField });
    
    res.json({
      success: true,
      field: field,
      coursesCount: fieldCourses.length,
      courses: fieldCourses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});