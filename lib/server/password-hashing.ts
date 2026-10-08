import * as argon2Runtime from "@node-rs/argon2";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import type { Options } from "@node-rs/argon2";

type RuntimeEnums = {
  Algorithm: { Argon2id: NonNullable<Options["algorithm"]> };
  Version: { V0x13: NonNullable<Options["version"]> };
};

// @node-rs/argon2 declares these as ambient const enums; read their runtime values
// through a typed namespace cast to remain compatible with isolatedModules.
const runtimeEnums = argon2Runtime as unknown as RuntimeEnums;
const ARGON_OPTIONS: Options = {
  algorithm: runtimeEnums.Algorithm.Argon2id,
  version: runtimeEnums.Version.V0x13,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 256) {
    throw new Error("Password must be between 14 and 256 characters.");
  }
  return argon2Hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(encodedHash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify(encodedHash, password);
  } catch {
    return false;
  }
}
