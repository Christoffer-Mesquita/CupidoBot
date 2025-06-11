import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mercadoPagoId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'BRL'
    },
    status: {
        type: String,
        required: true,
        default: 'pending'
    },
    metadata: {
        packageType: String,
        duration: Number,
        userPhone: String,
        pixCode: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

paymentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export const Payment = mongoose.model('Payment', paymentSchema); 