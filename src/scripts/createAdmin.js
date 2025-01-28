// src/scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdmin(username, password) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create default organization first (temporary solution)
    const defaultOrg = new mongoose.Types.ObjectId();

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await User.create({
      username,
      password: hashedPassword,
      role: 'admin',
      organization: defaultOrg // We'll update this later when we add organization management
    });

    console.log(`Admin user ${username} created successfully`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Please provide username and password');
  console.error('Usage: npm run create-admin <username> <password>');
  process.exit(1);
}

createAdmin(username, password);