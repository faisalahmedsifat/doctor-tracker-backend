import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../src/config/env.js';
import { createAdmin } from '../src/modules/auth/auth.service.js';
import { Admin } from '../src/modules/auth/admin.model.js';

const seedSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12).max(128),
});

async function main(): Promise<void> {
  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before running the seed command.');
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
  try {
    // Production disables automatic index creation; explicitly ensure the
    // unique email constraint exists before creating the first administrator.
    await Admin.createIndexes();
    const admin = await createAdmin(parsed.data.ADMIN_EMAIL, parsed.data.ADMIN_PASSWORD);
    console.info(`Created administrator: ${admin.email}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin bootstrap failed.');
  process.exitCode = 1;
});
