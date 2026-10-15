const mongoose = require('mongoose');

const studentSessionSchema = new mongoose.Schema({
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentAccount',
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('StudentSession', studentSessionSchema);
