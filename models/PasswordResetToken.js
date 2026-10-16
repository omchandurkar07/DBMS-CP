const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentAccount',
        required: true,
        unique: true
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

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
