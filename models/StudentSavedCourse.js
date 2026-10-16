const mongoose = require('mongoose');

const studentSavedCourseSchema = new mongoose.Schema({
    studentAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentAccount',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    savedAt: {
        type: Date,
        required: true,
        default: Date.now
    }
}, { timestamps: true });

studentSavedCourseSchema.index({ studentAccount: 1, course: 1 }, { unique: true });
studentSavedCourseSchema.index({ studentAccount: 1, savedAt: -1 });

module.exports = mongoose.model('StudentSavedCourse', studentSavedCourseSchema);
