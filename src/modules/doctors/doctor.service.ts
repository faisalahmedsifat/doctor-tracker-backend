import { AppError } from '../../common/errors.js';
import { Patient } from '../patients/patient.model.js';
import { Appointment } from '../appointments/appointment.model.js';
import { Doctor, type DoctorDocument } from './doctor.model.js';
import type { DoctorInput, DoctorListQuery, DoctorUpdate } from './doctor.schemas.js';

type DoctorRecord = DoctorDocument & {
  _id: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

function serializeDoctor(doctor: DoctorRecord) {
  return {
    id: doctor._id.toString(),
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    email: doctor.email,
    phone: doctor.phone,
    specialty: doctor.specialty,
    licenseNumber: doctor.licenseNumber,
    yearsOfExperience: doctor.yearsOfExperience,
    consultationFee: doctor.consultationFee,
    status: doctor.status,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}

function escapeRegex(value: string): string {
  const special = '.^$*+?()[]{}|\\';
  return Array.from(value, (character) =>
    special.includes(character) ? String.fromCharCode(92) + character : character,
  ).join('');
}

function handleDuplicate(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    const key =
      'keyPattern' in error && typeof error.keyPattern === 'object' && error.keyPattern !== null
        ? Object.keys(error.keyPattern)[0]
        : undefined;
    throw new AppError(
      409,
      'DOCTOR_CONFLICT',
      key === 'email'
        ? 'A doctor with this email already exists.'
        : 'A doctor with this license number already exists.',
    );
  }
  throw error;
}

export async function listDoctors(query: DoctorListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.specialty)
    filter.specialty = { $regex: '^' + escapeRegex(query.specialty) + '$', $options: 'i' };
  if (query.search) {
    const term = escapeRegex(query.search);
    filter.$or = ['firstName', 'lastName', 'email', 'specialty', 'licenseNumber'].map((field) => ({
      [field]: { $regex: term, $options: 'i' },
    }));
  }
  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const sortField: Record<string, 1 | -1> =
    query.sortBy === 'name'
      ? { lastName: direction, firstName: direction }
      : { [query.sortBy]: direction };
  const skip = (query.page - 1) * query.limit;
  const [records, total] = await Promise.all([
    Doctor.find(filter).sort(sortField).skip(skip).limit(query.limit).lean(),
    Doctor.countDocuments(filter),
  ]);
  return {
    doctors: records.map((record) => serializeDoctor(record as unknown as DoctorRecord)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getDoctor(id: string) {
  const doctor = await Doctor.findById(id).lean();
  if (!doctor) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found.');
  return serializeDoctor(doctor as unknown as DoctorRecord);
}

export async function createDoctor(input: DoctorInput) {
  try {
    return serializeDoctor((await Doctor.create(input)) as unknown as DoctorRecord);
  } catch (error) {
    handleDuplicate(error);
  }
}

export async function updateDoctor(id: string, input: DoctorUpdate) {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      id,
      { $set: input },
      { returnDocument: 'after', runValidators: true },
    ).lean();
    if (!doctor) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found.');
    return serializeDoctor(doctor as unknown as DoctorRecord);
  } catch (error) {
    handleDuplicate(error);
  }
}

export async function deleteDoctor(id: string): Promise<void> {
  if (await Appointment.exists({ doctor: id })) {
    throw new AppError(409, 'DOCTOR_HAS_APPOINTMENTS', 'Delete or reassign this doctor’s appointments before deleting the doctor.');
  }
  if (await Patient.exists({ assignedDoctor: id })) {
    throw new AppError(
      409,
      'DOCTOR_HAS_PATIENTS',
      'Reassign this doctor’s patients before deleting the doctor.',
    );
  }
  const doctor = await Doctor.findByIdAndDelete(id);
  if (!doctor) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found.');
}
