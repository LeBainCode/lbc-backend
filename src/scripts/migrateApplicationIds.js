// src/scripts/migrateApplicationIds.js
require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const path = require('path');

// Import User model (adjust path relative to scripts folder)
const User = require('../models/User');

/**
 * Migration Script: Add Application IDs to Beta Applications
 * 
 * This script adds unique applicationId to all existing beta applications
 * that don't have one yet. This is required for the new beta application
 * management system.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(mongoUri);
    log(colors.green, '✅ Connected to MongoDB');
    log(colors.cyan, `📡 Database: ${mongoose.connection.name}`);
  } catch (error) {
    log(colors.red, '❌ Failed to connect to MongoDB:');
    console.error(error);
    process.exit(1);
  }
}

async function migrateApplicationIds() {
  try {
    log(colors.yellow, '\n🔄 Starting Beta Application ID Migration...\n');
    
    // Get statistics before migration
    const totalApplications = await User.countDocuments({
      'betaAccess.application.submittedAt': { $exists: true }
    });
    
    const applicationsWithoutId = await User.countDocuments({
      'betaAccess.application.submittedAt': { $exists: true },
      'betaAccess.application.applicationId': { $exists: false }
    });
    
    const applicationsWithId = totalApplications - applicationsWithoutId;
    
    log(colors.blue, `📊 Migration Statistics:`);
    log(colors.cyan, `   Total Applications: ${totalApplications}`);
    log(colors.green, `   Already Migrated: ${applicationsWithId}`);
    log(colors.yellow, `   Need Migration: ${applicationsWithoutId}`);
    
    if (applicationsWithoutId === 0) {
      log(colors.green, '\n✅ All applications already have IDs - no migration needed!');
      return { migrated: 0, total: totalApplications, alreadyMigrated: applicationsWithId };
    }
    
    log(colors.yellow, '\n🔧 Starting migration process...\n');
    
    // Find users that need migration
    const usersToMigrate = await User.find({
      'betaAccess.application.submittedAt': { $exists: true },
      'betaAccess.application.applicationId': { $exists: false }
    }).select('username email betaAccess');
    
    let migratedCount = 0;
    const migrationResults = [];
    
    for (const user of usersToMigrate) {
      try {
        if (user.betaAccess.application && user.betaAccess.application.submittedAt) {
          // Generate unique application ID
          const applicationId = new mongoose.Types.ObjectId().toString();
          
          // Update the user
          user.betaAccess.application.applicationId = applicationId;
          await user.save();
          
          migratedCount++;
          
          const result = {
            username: user.username,
            email: user.email,
            applicationId,
            submittedAt: user.betaAccess.application.submittedAt,
            status: user.betaAccess.application.status || 'pending'
          };
          
          migrationResults.push(result);
          
          log(colors.green, `   ✅ ${user.username} -> ${applicationId}`);
        }
      } catch (error) {
        log(colors.red, `   ❌ Failed to migrate ${user.username}: ${error.message}`);
      }
    }
    
    log(colors.green, `\n🎉 Migration completed successfully!`);
    log(colors.cyan, `   Migrated: ${migratedCount} applications`);
    
    // Verify migration
    const remainingUnmigrated = await User.countDocuments({
      'betaAccess.application.submittedAt': { $exists: true },
      'betaAccess.application.applicationId': { $exists: false }
    });
    
    if (remainingUnmigrated === 0) {
      log(colors.green, '✅ Verification: All applications now have IDs');
    } else {
      log(colors.yellow, `⚠️  Verification: ${remainingUnmigrated} applications still need migration`);
    }
    
    return {
      migrated: migratedCount,
      total: totalApplications,
      alreadyMigrated: applicationsWithId,
      results: migrationResults
    };
    
  } catch (error) {
    log(colors.red, '❌ Migration failed:');
    console.error(error);
    throw error;
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    log(colors.bright, '='.repeat(60));
    log(colors.bright, '  BETA APPLICATION ID MIGRATION SCRIPT');
    log(colors.bright, '='.repeat(60));
    
    await connectToDatabase();
    
    const results = await migrateApplicationIds();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    log(colors.bright, '\n' + '='.repeat(60));
    log(colors.green, '✅ MIGRATION COMPLETED SUCCESSFULLY');
    log(colors.bright, '='.repeat(60));
    log(colors.cyan, `📊 Final Results:`);
    log(colors.green, `   ✅ Migrated: ${results.migrated} applications`);
    log(colors.blue, `   📋 Total: ${results.total} applications`);
    log(colors.yellow, `   ⏱️  Duration: ${duration} seconds`);
    
    if (results.results && results.results.length > 0) {
      log(colors.cyan, '\n📝 Migrated Applications:');
      results.results.forEach(app => {
        log(colors.green, `   • ${app.username} (${app.status}) - ID: ${app.applicationId}`);
      });
    }
    
    log(colors.bright, '\n🚀 You can now use the new beta application system!');
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    log(colors.bright, '\n' + '='.repeat(60));
    log(colors.red, '❌ MIGRATION FAILED');
    log(colors.bright, '='.repeat(60));
    log(colors.red, `Error: ${error.message}`);
    log(colors.yellow, `Duration: ${duration} seconds`);
    
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log(colors.blue, '📡 Disconnected from MongoDB');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  log(colors.yellow, '\n⚠️  Received SIGINT, shutting down gracefully...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log(colors.yellow, '\n⚠️  Received SIGTERM, shutting down gracefully...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { migrateApplicationIds, connectToDatabase };