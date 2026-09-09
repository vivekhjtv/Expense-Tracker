import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Password hashing with scrypt from Node's own crypto module.
 *
 * scrypt is a memory-hard KDF designed for exactly this, and using the
 * built-in means no native module to compile on the deploy host — bcrypt's
 * native build is a common cause of failed container builds, and bcryptjs
 * trades that for being markedly slower.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);

  // Constant-time: a plain === leaks how much of the hash matched via timing.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
