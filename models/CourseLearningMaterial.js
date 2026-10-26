const mongoose = require('mongoose');

const courseLearningMaterialSchema = new mongoose.Schema({
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    lesson: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 180
    },
    contentType: {
        type: String,
        enum: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ],
        required: true
    },
    size: {
        type: Number,
        required: true,
        min: 1,
        max: 10 * 1024 * 1024
    },
    fileData: {
        type: Buffer,
        required: true
    }
}, { timestamps: true });

courseLearningMaterialSchema.index({ course: 1, lesson: 1, createdAt: 1 });

module.exports = mongoose.model('CourseLearningMaterial', courseLearningMaterialSchema);
