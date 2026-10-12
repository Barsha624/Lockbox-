import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bucket, isMissingObject, s3 } from "./s3";

/**
 * Email-and-password accounts, kept in the same S3 bucket as the files:
 *   users/_accounts/<sha256 of the email>.json
 *
 * "_accounts" can never be a real user folder, because user ids are Google's numeric ids or random UUIDs.
 * The password is never stored. Only a salted scrypt hash is, so even someone who could read the bucket
 * can't read the passwords.
 *
 * Known limits (fine for a portfolio project, noted so you can say so in an interview): no email
 * verification, no "forgot password" flow, and a password account and a Google account with the same email
 * are two separate vaults.
 */
export interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export class AccountExistsError extends Error {
  constructor() {
    super("An account with this email already exists.");
  }
}

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Returns a message for the first problem found, or null when the details are fine. */
export function validateRegistration(name: unknown, email: unknown, password: unknown): string | null {
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 60) return "Enter your name (up to 60 characters).";
  if (typeof email !== "string") return "Enter a valid email address.";
  const e = normalizeEmail(email);
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "Enter a valid email address.";
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for the password.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters for the password.`;
  return null;
}

// --- password hashing -------------------------------------------------------------------------------

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password, salt, KEY_LENGTH, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummyHash: Promise<string> | null = null;
/** Checked when the email doesn't exist, so "no such account" takes as long as "wrong password". */
export function verifyAgainstDummy(password: string): Promise<boolean> {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash.then((h) => verifyPassword(password, h)).then(() => false);
}

// --- storage ----------------------------------------------------------------------------------------

const accountKey = (email: string) => `users/_accounts/${createHash("sha256").update(normalizeEmail(email)).digest("hex")}.json`;

export async function findAccount(email: string): Promise<Account | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: accountKey(email) }));
    return JSON.parse((await res.Body?.transformToString()) ?? "null") as Account | null;
  } catch (err) {
    if (isMissingObject(err) || err instanceof SyntaxError) return null;
    throw err;
  }
}

export async function createAccount(input: { name: string; email: string; password: string }): Promise<Account> {
  const email = normalizeEmail(input.email);
  if (await findAccount(email)) throw new AccountExistsError();

  const account: Account = {
    id: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: accountKey(email),
      Body: JSON.stringify(account),
      ContentType: "application/json",
    }),
  );
  return account;
}
