const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    rollNumber: {
        type: String,
        required: true
    },
    Branch : {
        type: String,
        required: true
    }
});
    
module.exports = mongoose.model('Item', itemSchema);