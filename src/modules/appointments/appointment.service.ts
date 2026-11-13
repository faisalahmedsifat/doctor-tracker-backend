import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from '../../common/errors.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { Appointment, type AppointmentDocument } from './appointment.model.js';
import { withDoctorLocks } from './appointment-lock.service.js';
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

async function assertParticipants(patientId: string, doctorId: string, session?: ClientSession) {
  // MongoDB does not support parallel operations on a single transaction session.
  const patient = await Patient.findById(patientId).select('_id status').session(session ?? null).lean();
  const doctor = await Doctor.findById(doctorId).select('_id status').session(session ?? null).lean();
  if (!patient || patient.status !== 'active') throw new AppError(400, 'INVALID_PATIENT', 'Select an existing active patient.');
  if (!doctor || doctor.status !== 'active') throw new AppError(400, 'INVALID_DOCTOR', 'Select an existing active doctor.');
}

async function assertNoConflict(doctorId: string, start: Date, duration: number, session: ClientSession, excludeId?: string) {
  const end = new Date(start.getTime() + duration * 60_000);
  const candidates = await Appointment.find({
    doctor: doctorId,
    status: { $nin: ['cancelled', 'no_show'] },
    startAt: { $lt: end },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('startAt durationMinutes').session(session).lean();
  const conflict = candidates.some((item) =>
    item.startAt.getTime() + item.durationMinutes * 60_000 > start.getTime(),
  );
  if (conflict) throw new AppError(409, 'APPOINTMENT_CONFLICT', 'This doctor already has an appointment during the selected time.');
}

async function bumpDoctorScheduleVersion(doctorIds: string[], session: ClientSession) {
  for (const doctorId of [...new Set(doctorIds)].sort()) {
    const result = await Doctor.updateOne({ _id: doctorId }, { $inc: { scheduleVersion: 1 } }, { session });
    if (result.matchedCount !== 1) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'The selected doctor no longer exists.');
  }
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

async function inTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await operation(session);
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
      maxCommitTimeMS: 5000,
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function createAppointment(input: AppointmentInput) {
  const start = new Date(input.startAt);
  if (start <= new Date()) throw new AppError(400, 'APPOINTMENT_IN_PAST', 'Appointments must be scheduled in the future.');
  const id = await withDoctorLocks([input.doctorId], async (assertLocksOwned) =>
    inTransaction(async (session) => {
      await assertParticipants(input.patientId, input.doctorId, session);
      await bumpDoctorScheduleVersion([input.doctorId], session);
      if (!['cancelled', 'no_show'].includes(input.status)) {
        await assertNoConflict(input.doctorId, start, input.durationMinutes, session);
      }
      const { patientId, doctorId, startAt, ...rest } = input;
      const values = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
      const [record] = await Appointment.create([{
        ...values, patient: patientId, doctor: doctorId, startAt: new Date(startAt),
      }], { session });
      assertLocksOwned();
      return (record as AppointmentDocument & { _id: { toString(): string } })._id.toString();
    }),
  );
  return getAppointment(id);
}

export async function updateAppointment(id: string, input: AppointmentUpdate) {
  const initial = await Appointment.findById(id).lean();
  if (!initial) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  const initialDoctorId = initial.doctor.toString();
  const targetDoctorId = input.doctorId ?? initialDoctorId;

  await withDoctorLocks([initialDoctorId, targetDoctorId], async (assertLocksOwned) => {
    await inTransaction(async (session) => {
      const current = await Appointment.findById(id).session(session).lean();
      if (!current) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
      const currentDoctorId = current.doctor.toString();
      if (currentDoctorId !== initialDoctorId) {
        throw new AppError(409, 'APPOINTMENT_CHANGED_RETRY', 'This appointment was changed by another request. Refresh and try again.');
      }
      const patientId = input.patientId ?? current.patient.toString();
      const doctorId = input.doctorId ?? currentDoctorId;
      const start = input.startAt ? new Date(input.startAt) : current.startAt;
      const duration = input.durationMinutes ?? current.durationMinutes;
      const status = input.status ?? current.status;

      if (input.patientId || input.doctorId) await assertParticipants(patientId, doctorId, session);
      await bumpDoctorScheduleVersion([currentDoctorId, doctorId], session);

      if (!['cancelled', 'no_show'].includes(status)) {
        const schedulingChanged = Boolean(input.startAt || input.doctorId || input.durationMinutes);
        const statusChangedToUpcoming = Boolean(input.status && ['scheduled', 'confirmed'].includes(status));
        if ((schedulingChanged || statusChangedToUpcoming) && start <= new Date()) {
          throw new AppError(400, 'APPOINTMENT_IN_PAST', 'Active appointments must be scheduled in the future.');
        }
        await assertNoConflict(doctorId, start, duration, session, id);
      }

      const values = Object.fromEntries(Object.entries(input).filter(([key, value]) =>
        !['patientId', 'doctorId', 'startAt'].includes(key) && value !== undefined,
      ));
      await Appointment.updateOne({ _id: id }, {
        $set: {
          ...values,
          ...(input.patientId ? { patient: patientId } : {}),
          ...(input.doctorId ? { doctor: doctorId } : {}),
          ...(input.startAt ? { startAt: start } : {}),
        },
      }, { session, runValidators: true });
      assertLocksOwned();
    });
  });
  return getAppointment(id);
}

export async function deleteAppointment(id: string) {
  const initial = await Appointment.findById(id).lean();
  if (!initial) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  const doctorId = initial.doctor.toString();
  await withDoctorLocks([doctorId], async (assertLocksOwned) => {
    await inTransaction(async (session) => {
      const current = await Appointment.findById(id).session(session).lean();
      if (!current) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
      if (current.doctor.toString() !== doctorId) {
        throw new AppError(409, 'APPOINTMENT_CHANGED_RETRY', 'This appointment was changed by another request. Refresh and try again.');
      }
      await bumpDoctorScheduleVersion([doctorId], session);
      await Appointment.deleteOne({ _id: id }, { session });
      assertLocksOwned();
    });
  });
}
