import { AppError } from '../../common/errors.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { Appointment, type AppointmentDocument } from './appointment.model.js';
import type { AppointmentInput, AppointmentListQuery, AppointmentUpdate } from './appointment.schemas.js';

type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
type PopulatedAppointment = {
  _id: { toString(): string };
  patient: { _id: { toString(): string }; firstName: string; lastName: string; patientNumber: string };
  doctor: { _id: { toString(): string }; firstName: string; lastName: string; specialty: string };
  startAt: Date; durationMinutes: number; reason?: string | null; notes?: string | null;
  status: AppointmentStatus; createdAt: Date; updatedAt: Date;
};

function serialize(record: PopulatedAppointment) {
  return {
    id: record._id.toString(),
    patient: { id: record.patient._id.toString(), fullName: `${record.patient.firstName} ${record.patient.lastName}`, patientNumber: record.patient.patientNumber },
    doctor: { id: record.doctor._id.toString(), fullName: `Dr. ${record.doctor.firstName} ${record.doctor.lastName}`, specialty: record.doctor.specialty },
    startAt: record.startAt.toISOString(),
    endAt: new Date(record.startAt.getTime() + record.durationMinutes * 60_000).toISOString(),
    durationMinutes: record.durationMinutes,
    reason: record.reason ?? null,
    notes: record.notes ?? null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function assertParticipants(patientId: string, doctorId: string) {
  const [patient, doctor] = await Promise.all([
    Patient.findById(patientId).select('_id status').lean(),
    Doctor.findById(doctorId).select('_id status').lean(),
  ]);
  if (!patient || patient.status !== 'active') throw new AppError(400, 'INVALID_PATIENT', 'Select an existing active patient.');
  if (!doctor || doctor.status !== 'active') throw new AppError(400, 'INVALID_DOCTOR', 'Select an existing active doctor.');
}

async function assertNoConflict(doctorId: string, start: Date, duration: number, excludeId?: string) {
  const end = new Date(start.getTime() + duration * 60_000);
  const candidates = await Appointment.find({
    doctor: doctorId,
    status: { $nin: ['cancelled', 'no_show'] },
    startAt: { $lt: end },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('startAt durationMinutes').lean();
  const conflict = candidates.some((item) =>
    item.startAt.getTime() + item.durationMinutes * 60_000 > start.getTime(),
  );
  if (conflict) throw new AppError(409, 'APPOINTMENT_CONFLICT', 'This doctor already has an appointment during the selected time.');
}

function populated(query: ReturnType<typeof Appointment.find>) {
  return query.populate('patient', 'firstName lastName patientNumber')
    .populate('doctor', 'firstName lastName specialty');
}

export async function listAppointments(query: AppointmentListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.doctorId) filter.doctor = query.doctorId;
  if (query.patientId) filter.patient = query.patientId;
  if (query.dateFrom || query.dateTo) {
    filter.startAt = {
      ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { $lt: new Date(query.dateTo) } : {}),
    };
  }
  const records = await populated(Appointment.find(filter)).sort({ startAt: query.sortOrder, _id: 1 }).lean();
  let appointments = records.map((record) => serialize(record as unknown as PopulatedAppointment));
  if (query.search) {
    const term = query.search.toLocaleLowerCase();
    appointments = appointments.filter((item) =>
      [item.patient.fullName, item.patient.patientNumber, item.doctor.fullName, item.doctor.specialty, item.reason ?? '']
        .some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }
  const total = appointments.length;
  const skip = (query.page - 1) * query.limit;
  return {
    appointments: appointments.slice(skip, skip + query.limit),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getAppointment(id: string) {
  const record = await populated(Appointment.find({ _id: id })).then((items) => items[0]?.toObject());
  if (!record) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  return serialize(record as unknown as PopulatedAppointment);
}

export async function createAppointment(input: AppointmentInput) {
  await assertParticipants(input.patientId, input.doctorId);
  const start = new Date(input.startAt);
  if (start <= new Date()) throw new AppError(400, 'APPOINTMENT_IN_PAST', 'Appointments must be scheduled in the future.');
  if (!['cancelled', 'no_show'].includes(input.status)) await assertNoConflict(input.doctorId, start, input.durationMinutes);
  const { patientId, doctorId, startAt, ...rest } = input;
  const values = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
  const record = await Appointment.create({ ...values, patient: patientId, doctor: doctorId, startAt: new Date(startAt) } as never);
  return getAppointment((record as unknown as AppointmentDocument & { _id: { toString(): string } })._id.toString());
}

export async function updateAppointment(id: string, input: AppointmentUpdate) {
  const current = await Appointment.findById(id).lean();
  if (!current) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  const patientId = input.patientId ?? current.patient.toString();
  const doctorId = input.doctorId ?? current.doctor.toString();
  const start = input.startAt ? new Date(input.startAt) : current.startAt;
  const duration = input.durationMinutes ?? current.durationMinutes;
  const status = input.status ?? current.status;
  if (input.patientId || input.doctorId) await assertParticipants(patientId, doctorId);
  if (!['cancelled', 'no_show'].includes(status)) {
    const schedulingChanged = Boolean(input.startAt || input.doctorId || input.durationMinutes);
    const statusChangedToUpcoming = Boolean(input.status && ['scheduled', 'confirmed'].includes(status));
    if ((schedulingChanged || statusChangedToUpcoming) && start <= new Date()) throw new AppError(400, 'APPOINTMENT_IN_PAST', 'Active appointments must be scheduled in the future.');
    await assertNoConflict(doctorId, start, duration, id);
  }
  const values = Object.fromEntries(Object.entries(input).filter(([key, value]) =>
    !['patientId', 'doctorId', 'startAt'].includes(key) && value !== undefined,
  ));
  const startAt = input.startAt;
  await Appointment.findByIdAndUpdate(id, {
    $set: { ...values, ...(input.patientId ? { patient: patientId } : {}), ...(input.doctorId ? { doctor: doctorId } : {}), ...(startAt ? { startAt: start } : {}) },
  }, { returnDocument: 'after', runValidators: true });
  return getAppointment(id);
}

export async function deleteAppointment(id: string) {
  const deleted = await Appointment.findByIdAndDelete(id);
  if (!deleted) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
}
