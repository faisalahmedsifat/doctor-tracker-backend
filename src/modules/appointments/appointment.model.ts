import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

export const appointmentStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;

const appointmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  startAt: { type: Date, required: true },
  durationMinutes: { type: Number, required: true, min: 5, max: 480, default: 30 },
  reason: { type: String, trim: true, maxlength: 500, default: null },
  notes: { type: String, trim: true, maxlength: 2000, default: null },
  scheduleOverrideReason: { type: String, trim: true, maxlength: 500, default: null },
  status: { type: String, enum: appointmentStatuses, required: true, default: 'scheduled' },
}, { timestamps: true, versionKey: false });

appointmentSchema.index({ doctor: 1, startAt: 1 });
appointmentSchema.index({ patient: 1, startAt: 1 });
appointmentSchema.index({ status: 1, startAt: 1 });

export type AppointmentDocument = InferSchemaType<typeof appointmentSchema>;
export const Appointment: Model<AppointmentDocument> =
  (mongoose.models.Appointment as Model<AppointmentDocument> | undefined) ??
  mongoose.model<AppointmentDocument>('Appointment', appointmentSchema);
