const mongoose = require('mongoose');

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
    capacity: {
        type: Number,
        required: true,
        min: 1
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

module.exports = mongoose.model('Course', courseSchema);
