import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Appointment } from '../appointments/appointment.model.js';
import { Patient, type PatientDocument } from './patient.model.js';
import type { PatientInput, PatientListQuery, PatientUpdate } from './patient.schemas.js';

type PatientRecord = PatientDocument & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  assignedDoctor?: {
    _id: { toString(): string };
    firstName: string;
    lastName: string;
    specialty: string;
  } | null;
};

function serializePatient(patient: PatientRecord) {
  const doctor = patient.assignedDoctor;
  return {
    id: patient._id.toString(),
    patientNumber: patient.patientNumber,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email ?? null,
    address: patient.address ?? null,
    bloodGroup: patient.bloodGroup ?? null,
    emergencyContactName: patient.emergencyContactName ?? null,
    emergencyContactPhone: patient.emergencyContactPhone ?? null,
    assignedDoctor: doctor
      ? {
          id: doctor._id.toString(),
          fullName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
          specialty: doctor.specialty,
        }
      : null,
    status: patient.status,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function assertDoctorExists(doctorId: string | null | undefined): Promise<void> {
  if (doctorId && !(await Doctor.exists({ _id: doctorId }))) {
    throw new AppError(400, 'INVALID_ASSIGNED_DOCTOR', 'The assigned doctor does not exist.');
  }
}

function toCreateRecord(input: PatientInput) {
  const { assignedDoctorId, dateOfBirth, ...rest } = input;
  const values = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  return {
    ...values,
    dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`),
    assignedDoctor: assignedDoctorId ?? null,
    patientNumber: `PT-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
  } as Parameters<typeof Patient.create>[0];
}

function toUpdateRecord(input: PatientUpdate) {
  const { assignedDoctorId, dateOfBirth, ...rest } = input;
  const values = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  return {
    ...values,
    ...(dateOfBirth ? { dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`) } : {}),
    ...(assignedDoctorId !== undefined ? { assignedDoctor: assignedDoctorId } : {}),
  };
}

export async function listPatients(query: PatientListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.assignedDoctorId) filter.assignedDoctor = query.assignedDoctorId;
  if (query.search) {
    const term = escapeRegex(query.search);
    filter.$or = ['patientNumber', 'firstName', 'lastName', 'email', 'phone'].map((field) => ({
      [field]: { $regex: term, $options: 'i' },
    }));
  }
  const sort: Record<string, 'asc' | 'desc'> =
    query.sortBy === 'name'
      ? { lastName: query.sortOrder, firstName: query.sortOrder }
      : { [query.sortBy]: query.sortOrder };
  const skip = (query.page - 1) * query.limit;
  const [records, total] = await Promise.all([
    Patient.find(filter)
      .populate('assignedDoctor', 'firstName lastName specialty')
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);
  return {
    patients: records.map((record) => serializePatient(record as unknown as PatientRecord)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getPatient(id: string) {
  const patient = await Patient.findById(id)
    .populate('assignedDoctor', 'firstName lastName specialty')
    .lean();
  if (!patient) throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found.');
  return serializePatient(patient as unknown as PatientRecord);
}

export async function createPatient(input: PatientInput) {
  await assertDoctorExists(input.assignedDoctorId);
  const patient = await Patient.create(toCreateRecord(input));
  return getPatient(patient._id.toString());
}

export async function updatePatient(id: string, input: PatientUpdate) {
  await assertDoctorExists(input.assignedDoctorId);
  const patient = await Patient.findByIdAndUpdate(
    id,
    { $set: toUpdateRecord(input) },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  ).lean();
  if (!patient) throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found.');
  return getPatient(id);
}

export async function deletePatient(id: string): Promise<void> {
  if (await Appointment.exists({ patient: id })) {
    throw new AppError(409, 'PATIENT_HAS_APPOINTMENTS', 'Delete this patient’s appointments before deleting the patient.');
  }
  const patient = await Patient.findByIdAndDelete(id);
  if (!patient) throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found.');
}
