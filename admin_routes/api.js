const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
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
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Added size limit for security

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sispa')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import MOU schema
const MOU = require('../models/MOU');
const Course = require('../models/courses');
const School = require('../models/school');
const Field = require('../models/fields');
const Admin = require('../models/admin');
const PendingAdmin = require('../models/pendingAdmin');
const Candidate = require('../models/students');

// Input sanitization helper
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, ''); // Remove basic HTML tags
  }
  return input;
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

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
app.post('/api/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  // Sanitize inputs
  const sanitizedEmail = sanitizeInput(email);

  // Find admin by email
  const admin = await Admin.findOne({ email: sanitizedEmail.toLowerCase() });
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
}));

// Route to get all MOUs information
app.get('/api/mous', authenticateToken, asyncHandler(async (req, res) => {
  const mous = await MOU.find();
  res.json({
    success: true,
    count: mous.length,
    data: mous
  });
}));

// Route to get all currently running courses (completed = "no")
app.get('/api/courses/running', authenticateToken, asyncHandler(async (req, res) => {
  const runningCourses = await Course.find({ completed: "no" });
  res.json({
    success: true,
    count: runningCourses.length,
    data: runningCourses
  });
}));

// Route to get all schools with count > 0 as links
app.get('/api/schools/active', authenticateToken, asyncHandler(async (req, res) => {
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
}));

// Route that will be hit when admin clicks on school link
app.get('/api/schools/:schoolId', authenticateToken, asyncHandler(async (req, res) => {
  const schoolId = sanitizeInput(req.params.schoolId);
  
  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid school ID format'
    });
  }
  
  // First find the school to get its name
  const school = await School.findById(schoolId);
  if (!school) {
    return res.status(404).json({
      success: false,
      error: 'School not found'
    });
  }
  
  // Find all MOUs that belong to this school by name
  const schoolMOUs = await MOU.find({ nameOfPartnerInstitution: school.name });
  
  res.json({
    success: true,
    school: school,
    count: schoolMOUs.length,
    data: schoolMOUs
  });
}));

// Route to get all completed courses (completed = "yes")
app.get('/api/courses/completed', authenticateToken, asyncHandler(async (req, res) => {
  const completedCourses = await Course.find({ completed: "yes" });
  
  res.json({
    success: true,
    count: completedCourses.length,
    data: completedCourses
  });
}));

// Route to get total number of participants trained
app.get('/api/participants', authenticateToken, asyncHandler(async (req, res) => {
  const participants = await Candidate.find();
  res.json({
    success: true,
    count: participants.length,
    data: participants
  });
}));

// Route to get all fields as links
app.get('/api/fields', authenticateToken, asyncHandler(async (req, res) => {
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
}));

// Route that will be hit when admin clicks on field link
app.get('/api/fields/:fieldId', authenticateToken, asyncHandler(async (req, res) => {
  const fieldId = sanitizeInput(req.params.fieldId);
  
  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(fieldId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid field ID format'
    });
  }
  
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
}));

// Route for bulk importing MOUs from Excel
app.post('/api/mous/import', authenticateToken, upload.single('excelFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Excel file is required'
    });
  }

  try {
    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Excel file is empty or invalid'
      });
    }

    const results = {
      success: [],
      errors: [],
      duplicates: []
    };

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2;

      try {
        // Sanitize inputs
        const ID = sanitizeInput(row.ID || row.id || '');
        const nameOfPartnerInstitution = sanitizeInput(row.nameOfPartnerInstitution || row.NameOfPartnerInstitution || '');
        const strategicAreas = sanitizeInput(row.strategicAreas || row.StrategicAreas || '');

        // Validate required fields
        if (!ID || !nameOfPartnerInstitution || !strategicAreas) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields (ID, nameOfPartnerInstitution, strategicAreas)'
          });
          continue;
        }

        // Check for duplicate ID
        const existingMOU = await MOU.findOne({ ID: ID });
        if (existingMOU) {
          results.duplicates.push({
            row: rowNumber,
            data: row,
            error: 'MOU with this ID already exists'
          });
          continue;
        }

        // Check if school exists, create or update
        const trimmedSchoolName = nameOfPartnerInstitution.trim();
        let existingSchool = await School.findOne({ name: trimmedSchoolName });

        if (!existingSchool) {
          const newSchool = new School({
            name: trimmedSchoolName,
            count: 1
          });
          await newSchool.save();
        } else {
          existingSchool.count += 1;
          await existingSchool.save();
        }

        // Create new MOU
        const newMOU = new MOU({
          ID: ID.trim(),
          nameOfPartnerInstitution: trimmedSchoolName,
          strategicAreas: strategicAreas.trim()
        });

        const savedMOU = await newMOU.save();
        results.success.push({
          row: rowNumber,
          data: savedMOU
        });

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk import completed',
      results: {
        totalRows: jsonData.length,
        successCount: results.success.length,
        errorCount: results.errors.length,
        duplicateCount: results.duplicates.length,
        details: results
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error processing Excel file: ' + error.message
    });
  }
}));

// Route for bulk importing students from Excel
app.post('/api/participants/import', authenticateToken, upload.single('excelFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Excel file is required'
    });
  }

  try {
    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Excel file is empty or invalid'
      });
    }

    const results = {
      success: [],
      errors: [],
      duplicates: []
    };

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2;

      try {
        // Sanitize string fields
        const participantData = {};
        const stringFields = [
          'batchNo', 'rank', 'serialNumberRRU', 'enrollmentNumber', 'fullName',
          'birthPlace', 'birthState', 'country', 'aadharNo', 'mobileNumber',
          'alternateNumber', 'email', 'address'
        ];

        // Map and sanitize data from Excel row
        participantData.srNo = parseInt(row.srNo || row.SrNo || row.serialNumber || '0');
        participantData.batchNo = sanitizeInput(row.batchNo || row.BatchNo || '');
        participantData.rank = sanitizeInput(row.rank || row.Rank || '');
        participantData.serialNumberRRU = sanitizeInput(row.serialNumberRRU || row.SerialNumberRRU || '');
        participantData.enrollmentNumber = sanitizeInput(row.enrollmentNumber || row.EnrollmentNumber || '');
        participantData.fullName = sanitizeInput(row.fullName || row.FullName || '');
        participantData.gender = row.gender || row.Gender || '';
        participantData.dateOfBirth = row.dateOfBirth || row.DateOfBirth || '';
        participantData.birthPlace = sanitizeInput(row.birthPlace || row.BirthPlace || '');
        participantData.birthState = sanitizeInput(row.birthState || row.BirthState || '');
        participantData.country = sanitizeInput(row.country || row.Country || '');
        participantData.aadharNo = sanitizeInput(row.aadharNo || row.AadharNo || '');
        participantData.mobileNumber = sanitizeInput(row.mobileNumber || row.MobileNumber || '');
        participantData.alternateNumber = sanitizeInput(row.alternateNumber || row.AlternateNumber || '');
        participantData.email = sanitizeInput(row.email || row.Email || '');
        participantData.address = sanitizeInput(row.address || row.Address || '');

        // Validate required fields
        const requiredFields = [
          'srNo', 'batchNo', 'rank', 'serialNumberRRU', 'enrollmentNumber',
          'fullName', 'gender', 'dateOfBirth', 'birthPlace', 'birthState',
          'country', 'aadharNo', 'mobileNumber', 'email', 'address'
        ];

        let missingFields = [];
        for (const field of requiredFields) {
          if (!participantData[field] || (field === 'srNo' && participantData[field] === 0)) {
            missingFields.push(field);
          }
        }

        if (missingFields.length > 0) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: `Missing required fields: ${missingFields.join(', ')}`
          });
          continue;
        }

        // Validate date format
        const dateOfBirth = new Date(participantData.dateOfBirth);
        if (isNaN(dateOfBirth.getTime())) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'Invalid date format for dateOfBirth'
          });
          continue;
        }
        participantData.dateOfBirth = dateOfBirth;

        // Check for duplicates
        const existingParticipant = await Candidate.findOne({
          $or: [
            { enrollmentNumber: participantData.enrollmentNumber },
            { aadharNo: participantData.aadharNo },
            { email: participantData.email.toLowerCase() }
          ]
        });

        if (existingParticipant) {
          results.duplicates.push({
            row: rowNumber,
            data: row,
            error: 'Participant with this enrollment number, Aadhar number, or email already exists'
          });
          continue;
        }

        // Create new participant
        const newParticipant = new Candidate(participantData);
        const savedParticipant = await newParticipant.save();
        
        results.success.push({
          row: rowNumber,
          data: savedParticipant
        });

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk import completed',
      results: {
        totalRows: jsonData.length,
        successCount: results.success.length,
        errorCount: results.errors.length,
        duplicateCount: results.duplicates.length,
        details: results
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error processing Excel file: ' + error.message
    });
  }
}));

// Route for bulk importing courses from Excel
app.post('/api/courses/import', authenticateToken, upload.single('excelFile'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Excel file is required'
    });
  }

  try {
    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Excel file is empty or invalid'
      });
    }

    const results = {
      success: [],
      errors: [],
      duplicates: []
    };

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel row number (starting from row 2, assuming row 1 is headers)

      try {
        // Sanitize inputs
        const ID = sanitizeInput(row.ID || row.id || '');
        const Name = sanitizeInput(row.Name || row.name || '');
        const field = sanitizeInput(row.field || row.Field || '');
        const eligibleDepartments = row.eligibleDepartments || row.EligibleDepartments || '';
        const startDate = row.startDate || row.StartDate || '';
        const endDate = row.endDate || row.EndDate || '';
        const completed = row.completed || row.Completed || 'no';

        // Validate required fields
        if (!ID || !Name || !field || !eligibleDepartments || !startDate || !endDate) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields (ID, Name, field, eligibleDepartments, startDate, endDate)'
          });
          continue;
        }

        // Check for duplicate ID
        const existingCourse = await Course.findOne({ ID: ID });
        if (existingCourse) {
          results.duplicates.push({
            row: rowNumber,
            data: row,
            error: 'Course with this ID already exists'
          });
          continue;
        }

        // Process eligibleDepartments - convert string to array if needed
        let departmentsArray;
        if (typeof eligibleDepartments === 'string') {
          departmentsArray = eligibleDepartments.split(',').map(dept => sanitizeInput(dept).trim()).filter(dept => dept);
        } else if (Array.isArray(eligibleDepartments)) {
          departmentsArray = eligibleDepartments.map(dept => sanitizeInput(dept).trim()).filter(dept => dept);
        } else {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'eligibleDepartments must be a string (comma-separated) or array'
          });
          continue;
        }

        if (departmentsArray.length === 0) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'At least one eligible department must be specified'
          });
          continue;
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'Invalid date format'
          });
          continue;
        }

        if (startDateObj >= endDateObj) {
          results.errors.push({
            row: rowNumber,
            data: row,
            error: 'End date must be after start date'
          });
          continue;
        }

        // Check if field exists, create if not
        const trimmedField = field.trim();
        let existingField = await Field.findOne({ nameOfTheField: trimmedField });

        if (!existingField) {
          const newField = new Field({
            nameOfTheField: trimmedField,
            count: 1
          });
          await newField.save();
        } else {
          existingField.count += 1;
          await existingField.save();
        }

        // Create new course
        const newCourse = new Course({
          ID: ID.trim(),
          Name: Name.trim(),
          eligibleDepartments: departmentsArray,
          startDate: startDateObj,
          endDate: endDateObj,
          completed: completed || 'no',
          field: trimmedField
        });

        const savedCourse = await newCourse.save();
        results.success.push({
          row: rowNumber,
          data: savedCourse
        });

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk import completed',
      results: {
        totalRows: jsonData.length,
        successCount: results.success.length,
        errorCount: results.errors.length,
        duplicateCount: results.duplicates.length,
        details: results
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error processing Excel file: ' + error.message
    });
  }
}));

// Route for admin registration
app.post('/api/admin/register', asyncHandler(async (req, res) => {
  // Retrieve all the information about the new admin
  let { name, email, phoneNumber, password } = req.body;

  // Sanitize inputs
  name = sanitizeInput(name);
  email = sanitizeInput(email);
  phoneNumber = sanitizeInput(phoneNumber);

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
}));

// Route for email verification - YES option (kept as GET for email links)
app.get('/api/admin/verify/yes/:pendingAdminId', asyncHandler(async (req, res) => {
  const pendingAdminId = sanitizeInput(req.params.pendingAdminId);

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(pendingAdminId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid pending admin ID format'
    });
  }

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
}));

// Route for email verification - NO option (kept as GET for email links)
app.get('/api/admin/verify/no/:pendingAdminId', asyncHandler(async (req, res) => {
  const pendingAdminId = sanitizeInput(req.params.pendingAdminId);

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(pendingAdminId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid pending admin ID format'
    });
  }

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
}));

// Route for admin to add new MOU
app.post('/api/mous', authenticateToken, asyncHandler(async (req, res) => {
  // Retrieve the information about the MOU from request body
  let { ID, nameOfPartnerInstitution, strategicAreas } = req.body;
  
  // Sanitize inputs
  ID = sanitizeInput(ID);
  nameOfPartnerInstitution = sanitizeInput(nameOfPartnerInstitution);
  strategicAreas = sanitizeInput(strategicAreas);
  
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
}));

// Route for admin to add new Course
app.post('/api/courses', authenticateToken, asyncHandler(async (req, res) => {
  // Retrieve all the information about the course from request body
  let { 
    ID, 
    Name, 
    eligibleDepartments, 
    startDate, 
    endDate, 
    completed, 
    field 
  } = req.body;
  
  // Sanitize inputs
  ID = sanitizeInput(ID);
  Name = sanitizeInput(Name);
  field = sanitizeInput(field);
  
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
  
  // Sanitize eligibleDepartments array
  const sanitizedDepartments = eligibleDepartments.map(dept => sanitizeInput(dept).trim());
  
  // Create new Course object
  const newCourse = new Course({
    ID: ID.trim(),
    Name: Name.trim(),
    eligibleDepartments: sanitizedDepartments,
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
}));

// Add route for adding participants/students
app.post('/api/participants', authenticateToken, asyncHandler(async (req, res) => {
  let participantData = { ...req.body };
  
  // Sanitize string fields
  const stringFields = [
    'batchNo', 'rank', 'serialNumberRRU', 'enrollmentNumber', 'fullName',
    'birthPlace', 'birthState', 'country', 'aadharNo', 'mobileNumber',
    'alternateNumber', 'email', 'address'
  ];
  
  stringFields.forEach(field => {
    if (participantData[field]) {
      participantData[field] = sanitizeInput(participantData[field]);
    }
  });
  
  // Validate required fields
  const requiredFields = [
    'srNo', 'batchNo', 'rank', 'serialNumberRRU', 'enrollmentNumber',
    'fullName', 'gender', 'dateOfBirth', 'birthPlace', 'birthState',
    'country', 'aadharNo', 'mobileNumber', 'email', 'address'
  ];
  
  for (const field of requiredFields) {
    if (!participantData[field]) {
      return res.status(400).json({
        success: false,
        error: `${field} is required`
      });
    }
  }
  
  // Create new participant
  const newParticipant = new Candidate(participantData);
  const savedParticipant = await newParticipant.save();
  
  res.status(201).json({
    success: true,
    message: 'Participant added successfully',
    data: savedParticipant
  });
}));

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle duplicate key error specifically
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry - record already exists'
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  
  // Handle cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});