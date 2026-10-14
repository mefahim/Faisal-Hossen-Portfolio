# Hostinger Argon2 Runtime Fix

## Root cause
Hostinger runtime failed to load the native binding from `@node-rs/argon2`.

## Fix
Replaced the native `@node-rs/argon2` dependency with `hash-wasm` Argon2id (WASM).
The Argon2id policy remains: memory=19456 KiB, iterations=2, parallelism=1, hash length=32 bytes.

## Deployment
1. Upload this full project ZIP to Hostinger.
2. Keep Node.js 22 and pnpm 11.
3. Build command: `pnpm run build`
4. Output directory: `.next`
5. Hostinger should detect the Next.js standalone server.
6. Restart the Node.js application after deployment.

Existing PHC Argon2id hashes remain compatible because verification uses standard Argon2id PHC strings.
