const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    studentName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    studentEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 254
    },
    studentAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentAccount'
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

enrollmentSchema.index({ course: 1, studentEmail: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
