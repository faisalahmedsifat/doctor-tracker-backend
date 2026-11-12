import bcrypt from 'bcryptjs';
import { Admin } from './admin.model.js';
import { AppError } from '../../common/errors.js';

const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$eswoRDwgrIffIyZJHDrs6.uyWX20GUkhIzZcHR/SluC8Uk355gCFW';

export interface PublicAdmin {
  id: string;
  email: string;
  role: 'admin';
}

function toPublicAdmin(admin: { _id: { toString(): string }; email: string; role: 'admin' }): PublicAdmin {
  return { id: admin._id.toString(), email: admin.email, role: admin.role };
}

export async function authenticateAdmin(email: string, password: string): Promise<PublicAdmin> {
  const admin = await Admin.findOne({ email }).select('+passwordHash');

  // Perform a bcrypt comparison for unknown/disabled accounts too, reducing
  // account-enumeration signals caused by substantially different response times.
  if (!admin || !admin.isActive) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!validPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  return toPublicAdmin(admin);
}

export async function getActiveAdmin(adminId: string): Promise<PublicAdmin> {
  const admin = await Admin.findOne({ _id: adminId, isActive: true }).select('_id email role');
  if (!admin) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return toPublicAdmin(admin);
}

export async function createAdmin(email: string, password: string): Promise<PublicAdmin> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await Admin.exists({ email: normalizedEmail });
  if (existing) {
    throw new AppError(409, 'ADMIN_ALREADY_EXISTS', 'An administrator with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const admin = await Admin.create({ email: normalizedEmail, passwordHash, role: 'admin' });
    return toPublicAdmin(admin);
  } catch (error) {
    // The unique database index remains the final guard against concurrent bootstrap attempts.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw new AppError(409, 'ADMIN_ALREADY_EXISTS', 'An administrator with this email already exists.');
    }
    throw error;
  }
}
