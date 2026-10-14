import "server-only";

import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

const ARGON_OPTIONS = {
  memorySize: 19_456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
};

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 256) {
    throw new Error("Password must be between 14 and 256 characters.");
  }

  return argon2id({
    password,
    salt: randomBytes(16),
    ...ARGON_OPTIONS,
    outputType: "encoded",
  });
}

export async function verifyPassword(
  encodedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2Verify({
      password,
      hash: encodedHash,
    });
  } catch {
    return false;
  }
}
