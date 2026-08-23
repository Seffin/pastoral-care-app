/**
 * Field-Level AES-256-GCM Encryption Utilities (Backend)
 * -------------------------------------------------------
 * Encrypts individual sensitive columns (phone, address, visit notes)
 * before they are persisted, independent of any transport/at-rest
 * disk encryption Postgres itself may have. This gives defense in
 * depth: a DB dump or backup leak does not expose plaintext PII.
 *
 * Key management:
 *   - The master key (`ENCRYPTION_MASTER_KEY`) MUST be a 32-byte key,
 *     base64-encoded, injected via environment variable / secrets
 *     manager (AWS Secrets Manager, GCP Secret Manager, Vault, etc).
 *     NEVER commit it, NEVER log it.
 *   - Each encrypted value gets its own random 12-byte IV (nonce),
 *     stored alongside the ciphertext, so the same plaintext never
 *     produces the same ciphertext twice.
 *   - GCM's authentication tag is appended to the ciphertext and
 *     verified on decrypt, so tampering is detected rather than
 *     silently decrypted into garbage.
 *   - Rotate the master key by re-encrypting all rows in a background
 *     migration; keep the previous key available read-only during
 *     rotation (see docs/SECURITY.md).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recommended nonce length for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

export interface EncryptedField {
  ciphertext: Buffer; // ciphertext || authTag, concatenated
  iv: Buffer;
}

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY is not set. Refusing to encrypt/decrypt without a key.'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must decode to exactly 32 bytes (AES-256).');
  }
  return key;
}

/** Encrypts a UTF-8 plaintext string. Returns ciphertext+tag and the IV used. */
export function encryptField(plaintext: string): EncryptedField {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, authTag]),
    iv,
  };
}

/** Decrypts a value produced by encryptField. Throws if the auth tag is invalid. */
export function decryptField(ciphertextWithTag: Buffer, iv: Buffer): string {
  const key = getMasterKey();

  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - AUTH_TAG_LENGTH_BYTES);
  const encrypted = ciphertextWithTag.subarray(0, ciphertextWithTag.length - AUTH_TAG_LENGTH_BYTES);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Convenience helper for nullable fields (e.g. optional address). */
export function encryptNullableField(plaintext: string | null | undefined): EncryptedField | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  return encryptField(plaintext);
}

export function decryptNullableField(
  ciphertextWithTag: Buffer | null,
  iv: Buffer | null
): string | null {
  if (!ciphertextWithTag || !iv) return null;
  return decryptField(ciphertextWithTag, iv);
}
