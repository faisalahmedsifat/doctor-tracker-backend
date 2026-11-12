import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const doctorSchema = new Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  specialty: { type: String, required: true, trim: true, maxlength: 100 },
  licenseNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 50 },
  yearsOfExperience: { type: Number, required: true, min: 0, max: 70 },
  consultationFee: { type: Number, required: true, min: 0, max: 1000000 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
}, { timestamps: true, versionKey: false });

doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ licenseNumber: 1 }, { unique: true });
doctorSchema.index({ status: 1, specialty: 1, createdAt: -1 });
doctorSchema.index({ lastName: 1, firstName: 1 });

export type DoctorDocument = InferSchemaType<typeof doctorSchema>;
export const Doctor: Model<DoctorDocument> =
  (mongoose.models.Doctor as Model<DoctorDocument> | undefined) ?? mongoose.model<DoctorDocument>('Doctor', doctorSchema);
