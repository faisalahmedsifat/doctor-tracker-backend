import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';

type RecentPatientRecord = {
  _id: { toString(): string };
  patientNumber: string;
  firstName: string;
  lastName: string;
  assignedDoctor?: { firstName: string; lastName: string } | null;
  createdAt: Date;
  status: 'active' | 'inactive';
};

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export async function getDashboardOverview(now = new Date()) {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));

  const [
    totalDoctors,
    activeDoctors,
    totalPatients,
    activePatients,
    newPatientsThisMonth,
    newPatientsLastMonth,
    assignedPatients,
    trendRows,
    doctorRows,
    recentRows,
  ] = await Promise.all([
    Doctor.countDocuments(),
    Doctor.countDocuments({ status: 'active' }),
    Patient.countDocuments(),
    Patient.countDocuments({ status: 'active' }),
    Patient.countDocuments({ createdAt: { $gte: currentMonthStart, $lt: nextMonthStart } }),
    Patient.countDocuments({ createdAt: { $gte: previousMonthStart, $lt: currentMonthStart } }),
    Patient.countDocuments({ assignedDoctor: { $ne: null } }),
    Patient.aggregate([
      { $match: { createdAt: { $gte: trendStart, $lt: nextMonthStart } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Patient.aggregate([
      { $match: { assignedDoctor: { $ne: null } } },
      { $group: { _id: '$assignedDoctor', patients: { $sum: 1 } } },
      { $sort: { patients: -1, _id: 1 } },
      { $limit: 5 },
      { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: '$doctor' },
      {
        $project: {
          _id: 0,
          name: { $concat: ['Dr. ', '$doctor.firstName', ' ', '$doctor.lastName'] },
          patients: 1,
        },
      },
    ]),
    Patient.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .populate('assignedDoctor', 'firstName lastName')
      .lean(),
  ]);

  const counts = new Map<string, number>(
    trendRows.map((row: { _id: { year: number; month: number }; count: number }) => [
      `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
      row.count,
    ]),
  );
  const patientGrowth = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6 + index, 1));
    return { month: monthLabel(date), patients: counts.get(monthKey(date)) ?? 0 };
  });

  const previousPeriodChange =
    newPatientsLastMonth === 0
      ? newPatientsThisMonth > 0
        ? 100
        : 0
      : Math.round(((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth) * 1000) /
        10;

  return {
    metrics: {
      totalDoctors,
      activeDoctors,
      totalPatients,
      activePatients,
      averagePatientsPerActiveDoctor: activeDoctors
        ? Math.round((activePatients / activeDoctors) * 10) / 10
        : 0,
      newPatientsThisMonth,
      newPatientsLastMonth,
      newPatientsChangePercent: previousPeriodChange,
      assignedPatients,
    },
    patientGrowth,
    patientsByDoctor: doctorRows,
    recentPatients: recentRows.map((rawPatient) => {
      const patient = rawPatient as unknown as RecentPatientRecord;
      return {
        id: patient._id.toString(),
        patientNumber: patient.patientNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        assignedDoctor: patient.assignedDoctor
          ? `Dr. ${patient.assignedDoctor.firstName} ${patient.assignedDoctor.lastName}`
          : null,
        createdAt: patient.createdAt.toISOString(),
        status: patient.status,
      };
    }),
    generatedAt: now.toISOString(),
  };
}
