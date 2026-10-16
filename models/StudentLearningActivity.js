const mongoose = require('mongoose');

const studentLearningActivitySchema = new mongoose.Schema({
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
    lesson: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    minutes: {
        type: Number,
        required: true,
        min: 1,
        max: 600
    },
    activityAt: {
        type: Date,
        required: true,
        default: Date.now
    }
}, { timestamps: true });

studentLearningActivitySchema.index(
    { studentAccount: 1, course: 1, lesson: 1 },
    { unique: true }
);

module.exports = mongoose.model('StudentLearningActivity', studentLearningActivitySchema);
