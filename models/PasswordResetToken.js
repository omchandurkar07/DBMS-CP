const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'accountModel',
        required: true,
    },
    accountModel: {
        type: String,
        enum: ['StudentAccount', 'TeacherAccount'],
        default: 'StudentAccount',
        required: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        match: /^[a-f0-9]{64}$/
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0
    }
}, { timestamps: true });

passwordResetTokenSchema.index({ accountModel: 1, account: 1 }, { unique: true });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
