import mongoose, { Document, Schema } from 'mongoose';
import { PackageType } from '../../utils/constants';

export interface IUser extends Document {
    phoneNumber: string;
    name: string;
    createdAt: Date;
    lastInteraction: Date;
    status: 'active' | 'inactive' | 'blocked';
    subscription?: {
        plan: PackageType;
        expiresAt: Date;
        isActive: boolean;
    };
    preferences?: {
        ageRange?: {
            min: number;
            max: number;
        };
        gender?: string;
        location?: string;
    };
}

const UserSchema = new Schema<IUser>({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastInteraction: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'blocked'],
        default: 'active'
    },
    subscription: {
        plan: {
            type: String,
            enum: ['BASIC', 'PREMIUM', 'VIP']
        },
        expiresAt: Date,
        isActive: {
            type: Boolean,
            default: false
        }
    },
    preferences: {
        ageRange: {
            min: Number,
            max: Number
        },
        gender: String,
        location: String
    }
});

export const User = mongoose.model<IUser>('User', UserSchema); 