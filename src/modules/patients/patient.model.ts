import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const patientSchema = new Schema(
  {
    patientNumber: { type: String, required: true, immutable: true },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    dateOfBirth: { type: Date, required: true },
    gender: {
      type: String,
      enum: ['female', 'male', 'other', 'prefer_not_to_say'],
      required: true,
    },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: null },
    address: { type: String, trim: true, maxlength: 300, default: null },
    condition: { type: String, trim: true, maxlength: 500, default: null },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      default: null,
    },
    emergencyContactName: { type: String, trim: true, maxlength: 120, default: null },
    emergencyContactPhone: { type: String, trim: true, maxlength: 30, default: null },
    assignedDoctor: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
  },
  { timestamps: true, versionKey: false },
);

patientSchema.index({ patientNumber: 1 }, { unique: true });
patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ status: 1, createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ assignedDoctor: 1, status: 1 });

export type PatientDocument = InferSchemaType<typeof patientSchema>;
export const Patient: Model<PatientDocument> =
  (mongoose.models.Patient as Model<PatientDocument> | undefined) ??
  mongoose.model<PatientDocument>('Patient', patientSchema);
