const mongoose = require('mongoose');

const courseAnnouncementSchema = new mongoose.Schema({
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    authorAccount: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'authorAccountModel',
        required: true
    },
    authorAccountModel: {
        type: String,
        enum: ['StudentAccount', 'TeacherAccount'],
        required: true
    },
    authorName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    }
}, { timestamps: true });

courseAnnouncementSchema.index({ course: 1, createdAt: -1 });

module.exports = mongoose.model('CourseAnnouncement', courseAnnouncementSchema);
