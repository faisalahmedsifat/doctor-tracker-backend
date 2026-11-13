import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { Appointment } from '../src/modules/appointments/appointment.model.js';

const doctors = [
  { key: 'rahman', firstName: 'Ayesha', lastName: 'Rahman', specialty: 'Cardiology', phone: '+8801700001001', yearsOfExperience: 14, consultationFee: 1800 },
  { key: 'karim', firstName: 'Tanvir', lastName: 'Karim', specialty: 'Neurology', phone: '+8801700001002', yearsOfExperience: 11, consultationFee: 2000 },
  { key: 'islam', firstName: 'Nusrat', lastName: 'Islam', specialty: 'Dermatology', phone: '+8801700001003', yearsOfExperience: 8, consultationFee: 1200 },
  { key: 'chowdhury', firstName: 'Farhan', lastName: 'Chowdhury', specialty: 'Pediatrics', phone: '+8801700001004', yearsOfExperience: 17, consultationFee: 1500 },
  { key: 'sultana', firstName: 'Samira', lastName: 'Sultana', specialty: 'Orthopedics', phone: '+8801700001005', yearsOfExperience: 6, consultationFee: 1400 },
] as const;

const patientData = [
  ['Nabila', 'Hossain', 'female', '1992-03-14', 'A+', 'rahman'],
  ['Mahmud', 'Hasan', 'male', '1984-11-02', 'B+', 'rahman'],
  ['Sadia', 'Akter', 'female', '2001-07-21', 'O+', 'karim'],
  ['Imran', 'Khan', 'male', '1978-01-09', 'AB+', 'karim'],
  ['Tania', 'Ahmed', 'female', '1995-09-30', 'O-', 'islam'],
  ['Rafi', 'Uddin', 'male', '1989-05-18', 'B-', 'islam'],
  ['Maliha', 'Noor', 'female', '2016-02-11', 'A-', 'chowdhury'],
  ['Arif', 'Rahman', 'male', '2018-12-05', 'O+', 'chowdhury'],
  ['Sharmeen', 'Jahan', 'female', '1971-06-26', 'AB-', 'sultana'],
  ['Kamal', 'Haque', 'male', '1965-08-17', 'A+', 'sultana'],
  ['Zarin', 'Tasnim', 'female', '1999-04-03', 'B+', 'rahman'],
  ['Sabbir', 'Alam', 'male', '1990-10-12', 'O+', 'karim'],
] as const;

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await Promise.all([Doctor.createIndexes(), Patient.createIndexes(), Appointment.createIndexes()]);
    const doctorByKey = new Map<string, string>();
    for (const item of doctors) {
      const email = `demo.doctor.${item.key}@doctortracker.local`;
      const doctor = await Doctor.findOneAndUpdate(
        { email },
        { $set: { firstName: item.firstName, lastName: item.lastName, phone: item.phone, specialty: item.specialty, hospital: 'Demo General Hospital', workingHours: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00' }, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }, { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }, { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' }, { dayOfWeek: 6, startTime: '09:00', endTime: '13:00' }], licenseNumber: `DEMO-${item.key.toUpperCase()}-001`, yearsOfExperience: item.yearsOfExperience, consultationFee: item.consultationFee, status: 'active' }, $setOnInsert: { email, scheduleVersion: 0 } },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
      doctorByKey.set(item.key, doctor._id.toString());
    }

    const patientIds: string[] = [];
    for (let index = 0; index < patientData.length; index += 1) {
      const [firstName, lastName, gender, dob, bloodGroup, doctorKey] = patientData[index]!;
      const email = `demo.patient.${String(index + 1).padStart(2, '0')}@doctortracker.local`;
      const assignedDoctor = doctorByKey.get(doctorKey)!;
      const patient = await Patient.findOneAndUpdate(
        { email },
        { $set: { firstName, lastName, dateOfBirth: new Date(`${dob}T00:00:00.000Z`), gender, phone: `+880171000${String(index + 1).padStart(4, '0')}`, address: 'Dhanmondi, Dhaka', bloodGroup, emergencyContactName: 'Demo Emergency Contact', emergencyContactPhone: '+8801700001999', assignedDoctor, status: index === 11 ? 'inactive' : 'active' }, $setOnInsert: { email, patientNumber: `DEMO-PT-${String(index + 1).padStart(4, '0')}` } },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
      patientIds.push(patient._id.toString());
    }

    // Deterministic, non-overlapping records cover historical and upcoming dashboard/calendar states.
    const now = new Date();
    // All demo appointment slots are expressed in Dhaka wall-clock time (UTC+6).
    const dhakaNow = new Date(now.getTime() + 6 * 60 * 60_000);
    const slots = [
      { patient: 0, doctor: 'rahman', day: 0, hour: 9, status: 'confirmed', reason: 'DEMO-SEED:today-cardiac-review' },
      { patient: 1, doctor: 'rahman', day: 0, hour: 10, status: 'scheduled', reason: 'DEMO-SEED:today-bp-check' },
      { patient: 10, doctor: 'rahman', day: 0, hour: 11, status: 'completed', reason: 'DEMO-SEED:today-cardiology-follow-up' },
      { patient: 2, doctor: 'karim', day: 0, hour: 9, status: 'confirmed', reason: 'DEMO-SEED:today-neurology-review' },
      { patient: 3, doctor: 'karim', day: 0, hour: 10, status: 'scheduled', reason: 'DEMO-SEED:today-headache-consult' },
      { patient: 0, doctor: 'rahman', day: -35, hour: 9, status: 'completed', reason: 'DEMO-SEED:annual-cardiac-review' },
      { patient: 1, doctor: 'rahman', day: -20, hour: 10, status: 'completed', reason: 'DEMO-SEED:blood-pressure-follow-up' },
      { patient: 10, doctor: 'rahman', day: -5, hour: 11, status: 'no_show', reason: 'DEMO-SEED:missed-cardiology-visit' },
      { patient: 0, doctor: 'rahman', day: 2, hour: 9, status: 'confirmed', reason: 'DEMO-SEED:upcoming-cardiology-review' },
      { patient: 1, doctor: 'rahman', day: 2, hour: 10, status: 'scheduled', reason: 'DEMO-SEED:upcoming-bp-check' },
      { patient: 10, doctor: 'rahman', day: 5, hour: 9, status: 'scheduled', reason: 'DEMO-SEED:cardiology-follow-up' },
      { patient: 2, doctor: 'karim', day: -28, hour: 9, status: 'completed', reason: 'DEMO-SEED:neurology-consult' },
      { patient: 3, doctor: 'karim', day: -12, hour: 10, status: 'cancelled', reason: 'DEMO-SEED:cancelled-neurology-visit' },
      { patient: 3, doctor: 'karim', day: 3, hour: 11, status: 'scheduled', reason: 'DEMO-SEED:neurology-review' },
      { patient: 2, doctor: 'karim', day: 6, hour: 9, status: 'confirmed', reason: 'DEMO-SEED:headache-follow-up' },
      { patient: 4, doctor: 'islam', day: -18, hour: 9, status: 'completed', reason: 'DEMO-SEED:skin-consult' },
      { patient: 5, doctor: 'islam', day: 4, hour: 10, status: 'scheduled', reason: 'DEMO-SEED:dermatology-review' },
      { patient: 6, doctor: 'chowdhury', day: -10, hour: 9, status: 'completed', reason: 'DEMO-SEED:pediatric-checkup' },
      { patient: 7, doctor: 'chowdhury', day: 2, hour: 11, status: 'confirmed', reason: 'DEMO-SEED:child-health-review' },
      { patient: 8, doctor: 'sultana', day: -3, hour: 9, status: 'completed', reason: 'DEMO-SEED:orthopedic-consult' },
      { patient: 9, doctor: 'sultana', day: 7, hour: 10, status: 'scheduled', reason: 'DEMO-SEED:mobility-follow-up' },
    ] as const;

    for (const slot of slots) {
      let startAt = new Date(Date.UTC(
        dhakaNow.getUTCFullYear(),
        dhakaNow.getUTCMonth(),
        dhakaNow.getUTCDate() + slot.day,
        slot.hour - 6,
        0,
        0,
        0,
      ));
      // Keep upcoming bookings safely in the future if the seed runs after the selected hour.
      if (slot.day >= 0 && startAt <= now) {
        startAt = new Date(startAt.getTime() + 24 * 60 * 60_000);
      }
      const doctor = doctorByKey.get(slot.doctor)!;
      await Appointment.findOneAndUpdate(
        { reason: slot.reason },
        { $set: { patient: patientIds[slot.patient], doctor, startAt, durationMinutes: 30, reason: slot.reason, notes: 'Synthetic demonstration record. Not real patient data.', status: slot.status } },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
      );
    }

    const [doctorCount, patientCount, appointmentCount, demoAppointmentCount] = await Promise.all([
      Doctor.countDocuments(), Patient.countDocuments(), Appointment.countDocuments(), Appointment.countDocuments({ reason: /^DEMO-SEED:/ }),
    ]);
    console.info('Demo data seeded successfully (safe to rerun).');
    console.info(`Demo doctors: ${doctorByKey.size}; demo patients: ${patientIds.length}; demo appointments: ${slots.length}.`);
    console.info(`Database totals: ${doctorCount} doctors, ${patientCount} patients, ${appointmentCount} appointments (${demoAppointmentCount} demo appointments).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo data seed failed.');
  process.exitCode = 1;
});
