import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const adminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin'], default: 'admin', required: true },
    isActive: { type: Boolean, default: true, required: true, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export type AdminDocument = InferSchemaType<typeof adminSchema>;
export const Admin: Model<AdminDocument> =
  (mongoose.models.Admin as Model<AdminDocument> | undefined) ?? mongoose.model<AdminDocument>('Admin', adminSchema);
