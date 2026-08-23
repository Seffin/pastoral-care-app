/**
 * Mobile Security Layer: Field Encryption + Biometric Gate
 * -----------------------------------------------------------
 * Two independent layers of protection on-device:
 *
 *  1. SQLCipher encrypts the ENTIRE local database file. Its key is
 *     generated on first launch, stored only in the OS secure
 *     enclave/keystore (iOS Keychain / Android Keystore), and never
 *     written to disk in plaintext or sent to the server.
 *
 *  2. Individual sensitive fields (phone, address, visit notes) are
 *     additionally encrypted with AES-256-GCM using a SEPARATE data
 *     key, so a compromised SQLCipher key alone does not expose PII,
 *     and so encrypted blobs can sync to the server unchanged
 *     (the server never needs the mobile key or vice versa — each
 *     platform encrypts fields with its own key material end-to-end
 *     only if you adopt true E2E encryption; by default here, the
 *     server re-encrypts with its own master key on ingest — see
 *     docs/SECURITY.md for the trust-boundary diagram).
 *
 * Biometric auth gates app access (cold start + background resume)
 * but is deliberately NOT used as the encryption key itself — biometric
 * APIs return an authentication result, not stable key material, and
 * differ significantly between iOS (LocalAuthentication) and Android
 * (BiometricPrompt + Keystore-bound keys). Use the platform's
 * "biometry-gated keystore key" feature so the OS enforces the
 * biometric check before releasing the actual encryption key.
 */

import * as Keychain from 'react-native-keychain';
import ReactNativeBiometrics from 'react-native-biometrics';
import { NativeModules } from 'react-native';

const { AesGcmCrypto } = NativeModules; // thin native module wrapping platform AES-GCM primitives

const DATA_ENCRYPTION_KEY_ALIAS = 'pastoral_app_data_encryption_key_v1';
const IV_LENGTH_BYTES = 12;

// ---------------------------------------------------------------------
// Biometric gate
// ---------------------------------------------------------------------

const biometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export interface BiometricCheckResult {
  success: boolean;
  error?: string;
}

/** Call on cold start and on AppState transition to 'active' after background. */
export async function requireBiometricUnlock(
  promptMessage = 'Unlock to access member care records'
): Promise<BiometricCheckResult> {
  const { available } = await biometrics.isSensorAvailable();

  if (!available) {
    // Fall back to device passcode via OS-level credential prompt rather
    // than silently unlocking — never skip the gate outright.
    return { success: false, error: 'biometrics_unavailable_use_passcode_fallback' };
  }

  const { success } = await biometrics.simplePrompt({ promptMessage });
  return { success, error: success ? undefined : 'biometric_check_failed_or_cancelled' };
}

// ---------------------------------------------------------------------
// Field-level AES-256-GCM (data-at-rest, per-record)
// ---------------------------------------------------------------------

/** Fetches (or provisions on first run) the 32-byte data key from secure hardware storage. */
async function getOrCreateDataKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: DATA_ENCRYPTION_KEY_ALIAS });
  if (existing) return existing.password;

  const newKeyBase64: string = await AesGcmCrypto.generateKey(32);
  await Keychain.setGenericPassword('data_key', newKeyBase64, {
    service: DATA_ENCRYPTION_KEY_ALIAS,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return newKeyBase64;
}

export interface EncryptedFieldBlob {
  ciphertextBase64: string; // ciphertext + auth tag
  ivBase64: string;
}

export async function encryptFieldOnDevice(plaintext: string): Promise<EncryptedFieldBlob> {
  const key = await getOrCreateDataKey();
  const ivBase64: string = await AesGcmCrypto.randomBytes(IV_LENGTH_BYTES);
  const ciphertextBase64: string = await AesGcmCrypto.encrypt(plaintext, key, ivBase64);
  return { ciphertextBase64, ivBase64 };
}

export async function decryptFieldOnDevice(blob: EncryptedFieldBlob): Promise<string> {
  const key = await getOrCreateDataKey();
  return AesGcmCrypto.decrypt(blob.ciphertextBase64, key, blob.ivBase64);
}

/**
 * Wipes the on-device data encryption key (e.g. on logout from a
 * shared/kiosk device, or remote-wipe command). The SQLCipher-encrypted
 * DB file remains on disk but its sensitive fields become unrecoverable
 * without the server copy — pair this with a forced re-sync on next login.
 */
export async function purgeLocalDataKey(): Promise<void> {
  await Keychain.resetGenericPassword({ service: DATA_ENCRYPTION_KEY_ALIAS });
}
