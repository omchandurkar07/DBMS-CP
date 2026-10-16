const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    summary: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    content: {
        type: String,
        trim: true,
        maxlength: 20000,
        default: ''
    },
    videoUrl: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    durationMinutes: {
        type: Number,
        required: true,
        min: 1,
        max: 600
    }
});

const moduleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    lessons: {
        type: [lessonSchema],
        validate: {
            validator: (lessons) => lessons.length > 0,
            message: 'Each module must contain at least one lesson.'
        }
    }
});

const courseSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 32,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    category: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60
    },
    instructor: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    duration: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40
    },
    modules: {
        type: [moduleSchema],
        default: []
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    photoData: {
        type: Buffer
    },
    photoContentType: {
        type: String,
        enum: ['image/jpeg', 'image/png', 'image/webp']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentAccount',
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

courseSchema.index({ isActive: 1, title: 1 });
courseSchema.index({ isActive: 1, category: 1, title: 1 });
courseSchema.index({ isActive: 1, createdAt: -1, title: 1 });

module.exports = mongoose.model('Course', courseSchema);
