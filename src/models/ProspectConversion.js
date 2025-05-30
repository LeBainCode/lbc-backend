// models/ProspectConversion.js
const mongoose = require('mongoose');

const prospectConversionSchema = new mongoose.Schema({
    // Original prospect data
    originalProspect: {
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        type: {
            type: String,
            enum: ['individual', 'organization', 'other'],
            required: true
        },
        reachedOut: {
            type: Boolean,
            required: true
        },
        comment: {
            type: String,
            default: ''
        },
        prospectCreatedAt: {
            type: Date,
            required: true
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
    },
    
    // Converted user data
    convertedUser: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        role: {
            type: String,
            enum: ['user', 'beta', 'admin'],
            required: true
        },
        githubProfile: {
            username: String,
            profileUrl: String,
            avatarUrl: String
        },
        userCreatedAt: {
            type: Date,
            required: true
        }
    },
    
    // Conversion metadata
    conversion: {
        convertedAt: {
            type: Date,
            default: Date.now,
            required: true
        },
        convertedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        conversionType: {
            type: String,
            enum: ['manual', 'automatic'],
            default: 'manual'
        },
        conversionReason: {
            type: String,
            enum: [
                'email_match',
                'user_registered',
                'admin_decision',
                'duplicate_cleanup'
            ],
            default: 'email_match'
        },
        notes: {
            type: String,
            trim: true,
            maxlength: 500
        }
    },
    
    // Analytics data
    analytics: {
        daysFromProspectToConversion: {
            type: Number,
            required: true
        },
        wasReachedOut: {
            type: Boolean,
            required: true
        },
        prospectType: {
            type: String,
            enum: ['individual', 'organization', 'other'],
            required: true
        }
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for performance
prospectConversionSchema.index({ 'originalProspect.email': 1 });
prospectConversionSchema.index({ 'convertedUser.userId': 1 });
prospectConversionSchema.index({ 'convertedUser.username': 1 });
prospectConversionSchema.index({ 'conversion.convertedAt': -1 });
prospectConversionSchema.index({ 'conversion.convertedBy': 1 });
prospectConversionSchema.index({ 'conversion.conversionReason': 1 });

// Compound indexes
prospectConversionSchema.index({ 
    'analytics.wasReachedOut': 1, 
    'conversion.convertedAt': -1 
});
prospectConversionSchema.index({ 
    'analytics.prospectType': 1, 
    'conversion.convertedAt': -1 
});

// Virtual for conversion time in days
prospectConversionSchema.virtual('conversionTimeInDays').get(function() {
    const prospectDate = new Date(this.originalProspect.prospectCreatedAt);
    const conversionDate = new Date(this.conversion.convertedAt);
    const timeDiff = conversionDate - prospectDate;
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
});

// Instance methods
prospectConversionSchema.methods.getConversionSummary = function() {
    return {
        email: this.originalProspect.email,
        username: this.convertedUser.username,
        conversionDate: this.conversion.convertedAt,
        daysTaken: this.analytics.daysFromProspectToConversion,
        wasReachedOut: this.analytics.wasReachedOut,
        prospectType: this.analytics.prospectType,
        conversionReason: this.conversion.conversionReason
    };
};

// Static methods
prospectConversionSchema.statics.getConversionStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalConversions: { $sum: 1 },
                averageDaysToConvert: { $avg: '$analytics.daysFromProspectToConversion' },
                reachedOutConversions: {
                    $sum: { $cond: ['$analytics.wasReachedOut', 1, 0] }
                },
                notReachedOutConversions: {
                    $sum: { $cond: ['$analytics.wasReachedOut', 0, 1] }
                }
            }
        }
    ]);
    
    const conversionsByType = await this.aggregate([
        {
            $group: {
                _id: '$analytics.prospectType',
                count: { $sum: 1 },
                avgDays: { $avg: '$analytics.daysFromProspectToConversion' }
            }
        }
    ]);
    
    const conversionsByReason = await this.aggregate([
        {
            $group: {
                _id: '$conversion.conversionReason',
                count: { $sum: 1 }
            }
        }
    ]);
    
    return {
        overall: stats[0] || {
            totalConversions: 0,
            averageDaysToConvert: 0,
            reachedOutConversions: 0,
            notReachedOutConversions: 0
        },
        byType: conversionsByType,
        byReason: conversionsByReason
    };
};

prospectConversionSchema.statics.findByEmail = function(email) {
    return this.findOne({ 'originalProspect.email': email.toLowerCase().trim() });
};

prospectConversionSchema.statics.findByUser = function(userId) {
    return this.find({ 'convertedUser.userId': userId });
};

prospectConversionSchema.statics.findByDateRange = function(startDate, endDate) {
    return this.find({
        'conversion.convertedAt': {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ 'conversion.convertedAt': -1 });
};

// Pre-save middleware
prospectConversionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Calculate days from prospect to conversion if not already set
    if (!this.analytics.daysFromProspectToConversion) {
        const prospectDate = new Date(this.originalProspect.prospectCreatedAt);
        const conversionDate = new Date(this.conversion.convertedAt);
        const timeDiff = conversionDate - prospectDate;
        this.analytics.daysFromProspectToConversion = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    }
    
    next();
});

// Post-save logging
prospectConversionSchema.post('save', function(doc) {
    console.log(`Prospect conversion saved: ${doc.originalProspect.email} → User ${doc.convertedUser.username}`);
});

module.exports = mongoose.model('ProspectConversion', prospectConversionSchema);