// models/Prospect.js
const mongoose = require('mongoose');

const prospectSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    type: {
        type: String,
        enum: ['individual', 'organization', 'other'],
        default: 'individual'
    },
    reachedOut: {
        type: Boolean,
        default: false
    },
    comment: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUpdatedBy: {
        type: {
            admin: String,
            timestamp: Date
        },
        reachedOut: {
            admin: String,
            timestamp: Date
        },
        comment: {
            admin: String,
            timestamp: Date
        }
    }
});

module.exports = mongoose.model('Prospect', prospectSchema);