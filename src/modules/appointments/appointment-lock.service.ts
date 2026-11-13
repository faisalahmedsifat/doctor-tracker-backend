import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors.js';
import { env } from '../../config/env.js';
import { getRedis } from '../../database/redis.js';

const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`;
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

type HeldLock = { key: string; token: string };

async function acquire(key: string): Promise<HeldLock> {
  const redis = getRedis();
  const token = randomUUID();
  const deadline = Date.now() + env.REDIS_LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    const result = await redis.set(key, token, 'PX', env.REDIS_LOCK_TTL_MS, 'NX');
    if (result === 'OK') return { key, token };
    await new Promise((resolve) => setTimeout(resolve, 40 + Math.floor(Math.random() * 40)));
  }

  throw new AppError(409, 'APPOINTMENT_SCHEDULING_BUSY', 'This doctor schedule is being updated. Please retry shortly.');
}

/**
 * Redis reduces contention across API instances. MongoDB transactions and the
 * per-doctor scheduleVersion write remain the authoritative concurrency guard.
 */
export async function withDoctorLocks<T>(doctorIds: string[], operation: (assertLocksOwned: () => void) => Promise<T>): Promise<T> {
  const ids = [...new Set(doctorIds)].sort();
  const locks: HeldLock[] = [];
  const redis = getRedis();
  let leaseLost = false;
  let renewing = false;

  try {
    for (const id of ids) locks.push(await acquire(`doctor-tracker:appointment-lock:doctor:${id}`));

    const renewEveryMs = Math.max(1000, Math.floor(env.REDIS_LOCK_TTL_MS / 3));
    const timer = setInterval(() => {
      if (renewing) return;
      renewing = true;
      void Promise.all(locks.map((lock) =>
        redis.eval(RENEW_SCRIPT, 1, lock.key, lock.token, String(env.REDIS_LOCK_TTL_MS)),
      )).then((results: unknown[]) => {
        if (results.some((result: unknown) => Number(result) !== 1)) leaseLost = true;
      }).catch(() => {
        leaseLost = true;
      }).finally(() => {
        renewing = false;
      });
    }, renewEveryMs);
    timer.unref();

    try {
      const assertLocksOwned = () => {
        if (leaseLost) {
          throw new AppError(503, 'SCHEDULING_LOCK_LOST', 'The scheduling lock was lost. No appointment change was committed; please retry.');
        }
      };
      // The transaction callback checks ownership immediately before it returns.
      // Do not perform a second check after commit: reporting failure after a
      // successful commit could cause clients to retry an already-saved booking.
      return await operation(assertLocksOwned);
    } finally {
      clearInterval(timer);
    }
  } finally {
    await Promise.all(locks.map(async (lock) => {
      try {
        await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
      } catch {
        // A lease will expire automatically; never delete a lock without its token.
      }
    }));
  }
}
