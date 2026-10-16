const mongoose = require('mongoose');

const studentAccountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 254,
        unique: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    passwordSalt: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['student', 'teacher'],
        default: 'student',
        required: true
    },
    weeklyLearningGoalMinutes: {
        type: Number,
        min: 30,
        max: 1680,
        default: 300
    }
}, { timestamps: true });

module.exports = mongoose.model('StudentAccount', studentAccountSchema);
