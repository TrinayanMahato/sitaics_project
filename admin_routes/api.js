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
const MOU = require('../models/MOU');
const Course = require('../models/courses');
const School = require('../models/school');
const Field = require('../models/fields');

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


// Route for admin to add new MOU
app.post('/api/mous', async (req, res) => {
  try {
    // Retrieve the information about the MOU from request body
    const { ID, nameOfPartnerInstitution, strategicAreas } = req.body;
    // Validate required fields
    if (!ID || !nameOfPartnerInstitution || !strategicAreas) {
      return res.status(400).json({
        success: false,
        error: 'All fields (ID, nameOfPartnerInstitution, strategicAreas) are required'
      });
    }
    // Check if MOU with same ID already exists
    const existingMOU = await MOU.findOne({ ID: ID });
    if (existingMOU) {
      return res.status(409).json({
        success: false,
        error: 'MOU with this ID already exists'
      });
    }
    // Check if the school name exists in the School schema
    const trimmedSchoolName = nameOfPartnerInstitution.trim();
    let existingSchool = await School.findOne({ name: trimmedSchoolName });
    if (!existingSchool) {
      // If school doesn't exist, create new school with count = 1
      const newSchool = new School({
        name: trimmedSchoolName,
        count: 1
      });
      await newSchool.save();
    } else {
      // If school exists, increment its count by 1
      existingSchool.count += 1;
      await existingSchool.save();
    }
    // Create new MOU object
    const newMOU = new MOU({
      ID: ID.trim(),
      nameOfPartnerInstitution: trimmedSchoolName,
      strategicAreas: strategicAreas.trim()
    });
    // Save the MOU in the database
    const savedMOU = await newMOU.save();
    // Return success response
    res.status(201).json({
      success: true,
      message: 'MOU added successfully',
      data: savedMOU
    });
  } catch (error) {
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'MOU with this ID already exists'
      });
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    // Handle other errors
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

//create new courses


    // Route for admin to add new Course
app.post('/api/courses', async (req, res) => {
  try {
    // Retrieve all the information about the course from request body
    const { 
      ID, 
      Name, 
      eligibleDepartments, 
      startDate, 
      endDate, 
      completed, 
      field 
    } = req.body;
    
    // Validate required fields
    if (!ID || !Name || !eligibleDepartments || !startDate || !endDate || !field) {
      return res.status(400).json({
        success: false,
        error: 'All fields (ID, Name, eligibleDepartments, startDate, endDate, field) are required'
      });
    }
    
    // Validate eligibleDepartments is an array and not empty
    if (!Array.isArray(eligibleDepartments) || eligibleDepartments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'eligibleDepartments must be a non-empty array'
      });
    }
    
    // Check if Course with same ID already exists
    const existingCourse = await Course.findOne({ ID: ID });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        error: 'Course with this ID already exists'
      });
    }
    
    // Validate date format and logic
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Please use valid date format'
      });
    }
    
    if (startDateObj >= endDateObj) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }
    
    // Check if the field exists in the Field schema
    const trimmedField = field.trim();
    let existingField = await Field.findOne({ nameOfTheField: trimmedField });
    
    if (!existingField) {
      // If field doesn't exist, create new field with count = 1
      const newField = new Field({
        nameOfTheField: trimmedField,
        count: 1
      });
      await newField.save();
    } else {
      // If field exists, increment its count by 1
      existingField.count += 1;
      await existingField.save();
    }
    
    // Create new Course object
    const newCourse = new Course({
      ID: ID.trim(),
      Name: Name.trim(),
      eligibleDepartments: eligibleDepartments.map(dept => dept.trim()),
      startDate: startDateObj,
      endDate: endDateObj,
      completed: completed || 'no', // Default to 'no' if not provided
      field: trimmedField
    });
    
    // Save the Course in the database
    const savedCourse = await newCourse.save();
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Course added successfully',
      data: savedCourse
    });
  } catch (error) {
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Course with this ID already exists'
      });
    }
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    // Handle other errors
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});