const mongoose = require('mongoose');

const courseReviewSchema = new mongoose.Schema({
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    studentAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentAccount',
        required: true
    },
    authorName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'A course rating must be a whole number from 1 to 5.'
        }
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: ''
    }
}, { timestamps: true });

courseReviewSchema.index({ course: 1, studentAccount: 1 }, { unique: true });
courseReviewSchema.index({ course: 1, updatedAt: -1 });

module.exports = mongoose.model('CourseReview', courseReviewSchema);
