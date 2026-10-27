import { hash, verify } from "@node-rs/argon2";

const options = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const passwordHashOptions = options;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, options);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword("prompt-gallery-dummy-password");
  return dummyHash;
}

export async function passwordMatches(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  if (!passwordHash) {
    await verifyPassword(await dummyPasswordHash(), password);
    return false;
  }
  return verifyPassword(passwordHash, password);
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 12 || password.length > 200) {
    throw new Error("密码长度需要在 12 到 200 个字符之间");
  }
}

export function assertUsername(username: string): string {
  const value = username.trim();
  if (value.length < 1 || value.length > 64) {
    throw new Error("用户名长度需要在 1 到 64 个字符之间");
  }
  if (/\s/u.test(value)) {
    throw new Error("用户名不能包含空白");
  }
  return value;
}
