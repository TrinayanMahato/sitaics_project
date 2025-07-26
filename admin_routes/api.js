const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Configure Nodemailer
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
const Admin = require('../models/admin');
const PendingAdmin = require('../models/pendingAdmin');


// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};


// Login route - No authentication required
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        adminId: admin._id, 
        email: admin.email,
        name: admin.name 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


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

// Route for admin registration
app.post('/api/admin/register', async (req, res) => {
  try {
    // Retrieve all the information about the new admin
    const { name, email, phoneNumber, password } = req.body;

    // Validate required fields
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields (name, email, phoneNumber, password) are required'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        error: 'Admin with this email already exists'
      });
    }

    // Check if pending admin already exists
    const existingPendingAdmin = await PendingAdmin.findOne({ email: email.toLowerCase() });
    if (existingPendingAdmin) {
      return res.status(409).json({
        success: false,
        error: 'Registration request already pending for this email'
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create pending admin
    const pendingAdmin = new PendingAdmin({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      password: hashedPassword
    });

    await pendingAdmin.save();

    // Send verification email using nodemailer
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Admin Registration Verification - Rashtriya Raksha University',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Admin Registration Verification</h2>
          <p>Dear ${name},</p>
          <p>You have registered in our website <strong>Rashtriya Raksha University</strong> as an admin. Is it you?</p>
          <p>Please confirm your registration by clicking one of the options below:</p>
          <div style="margin: 20px 0;">
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/admin/verify/yes/${pendingAdmin._id}" 
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; margin-right: 10px; border-radius: 5px;">
               YES
            </a>
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/api/admin/verify/no/${pendingAdmin._id}" 
               style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
               NO
            </a>
          </div>
          <p>If you did not register for this account, please click NO.</p>
          <p>Thank you,<br>Rashtriya Raksha University Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      success: true,
      message: 'Registration request submitted successfully. Please check your email for verification.',
      pendingAdminId: pendingAdmin._id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route for email verification - YES option
app.get('/api/admin/verify/yes/:pendingAdminId', async (req, res) => {
  try {
    const { pendingAdminId } = req.params;

    // Find the pending admin
    const pendingAdmin = await PendingAdmin.findById(pendingAdminId);
    if (!pendingAdmin) {
      return res.status(404).json({
        success: false,
        error: 'Pending admin not found'
      });
    }

    // Check if already processed
    if (pendingAdmin.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Registration request already processed'
      });
    }

    // Create the admin
    const newAdmin = new Admin({
      name: pendingAdmin.name,
      email: pendingAdmin.email,
      phoneNumber: pendingAdmin.phoneNumber,
      password: pendingAdmin.password
    });

    await newAdmin.save();

    // Update pending admin status
    pendingAdmin.status = 'approved';
    pendingAdmin.processedDate = new Date();
    await pendingAdmin.save();

    res.json({
      success: true,
      message: 'Admin registration confirmed successfully! You can now login.',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route for email verification - NO option
app.get('/api/admin/verify/no/:pendingAdminId', async (req, res) => {
  try {
    const { pendingAdminId } = req.params;

    // Find the pending admin
    const pendingAdmin = await PendingAdmin.findById(pendingAdminId);
    if (!pendingAdmin) {
      return res.status(404).json({
        success: false,
        error: 'Pending admin not found'
      });
    }

    // Check if already processed
    if (pendingAdmin.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Registration request already processed'
      });
    }

    // Update pending admin status to rejected
    pendingAdmin.status = 'rejected';
    pendingAdmin.processedDate = new Date();
    await pendingAdmin.save();

    res.json({
      success: true,
      message: 'Admin registration has been declined. The request has been rejected.'
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