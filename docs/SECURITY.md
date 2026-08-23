# Security & Compliance Notes

This app handles sensitive pastoral-care information — contact
details, home addresses, and free-text notes that may reference
health, family, or personal crises. Treat it accordingly.

## Encryption layers

| Layer                          | Protects against                                  | Key location                                  |
|---------------------------------|----------------------------------------------------|------------------------------------------------|
| PostgreSQL field-level AES-256-GCM | DB dump/backup leak, insider query access to raw columns | `ENCRYPTION_MASTER_KEY` env var / secrets manager (server only) |
| SQLCipher (mobile DB file)     | Lost/stolen device, raw file extraction            | OS Keychain (iOS) / Keystore (Android)          |
| On-device field-level AES-256-GCM | Compromised SQLCipher key alone, buggy code that logs full rows | Keychain entry, gated by `BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE` |
| TLS in transit                 | Network eavesdropping / MITM                       | Standard cert, enforce HSTS at the edge/CDN     |

**The mobile and server encryption keys are independent.** In this
scaffold, the server re-encrypts notes with its own master key when a
visit syncs up (see `backend/src/api/visits.routes.ts`) rather than
storing the mobile ciphertext verbatim. If your compliance requirements
call for true end-to-end encryption (server never sees plaintext even
transiently), that's an architectural change worth discussing
explicitly — it affects search, the priority engine's ability to read
any encrypted field, and account-recovery UX, so don't adopt it
silently.

## Key management

- Never commit `ENCRYPTION_MASTER_KEY` or `JWT_SIGNING_SECRET` — use
  `.env` locally (gitignored) and a real secrets manager (AWS Secrets
  Manager, GCP Secret Manager, HashiCorp Vault) in any deployed
  environment.
- **Key rotation:** generate a new master key, keep the old one
  available read-only, run a background migration that decrypts every
  row with the old key and re-encrypts with the new one, then retire
  the old key. Never rotate by simply swapping the env var — existing
  ciphertext will become unreadable.
- **Mobile key loss:** if a device's Keychain/Keystore entry is wiped
  (factory reset, OS reinstall), on-device ciphertext for that device
  is unrecoverable by design. This is fine because the server holds
  the canonical, separately-encrypted copy — the next login re-syncs
  from the server rather than attempting local recovery.

## Authentication

- Passwords hashed with **argon2id** (`argon2` package), never bcrypt
  alone and never plaintext.
- Short-lived (15 min) JWT access tokens + longer-lived (30 day)
  refresh tokens. Access tokens carry `role` for authorization checks;
  never trust a role claim without verifying the JWT signature first
  (`requireAuth` middleware does this).
- Auth endpoints are rate-limited separately and more strictly (10 req
  / 15 min) than the general API, to blunt credential-stuffing.

## Biometric app lock

- Required on cold start and on returning from background — implement
  the `AppState` listener in the mobile app's root component to call
  `requireBiometricUnlock()` on every `background -> active` transition.
- Biometric APIs authenticate the *user*, not the *data*. The actual
  encryption key is stored in a Keychain/Keystore entry configured
  with `BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE`, so the OS — not
  application code — enforces that a successful biometric (or
  passcode fallback) check is required before the key is released.
  Don't build a parallel "if biometric succeeded, allow key access"
  check in JS; that's bypassable in ways the OS-level gate isn't.

## Data minimization & least privilege

- The dashboard list endpoint (`GET /members`) intentionally omits
  decrypted phone/address — only the single-member detail endpoint
  decrypts PII, and only over an authenticated, authorized request.
- Add role-based restrictions (`requireRole('admin', 'pastor')`) to
  the member detail and creation endpoints before production; the
  scaffold currently allows any authenticated user for simplicity.
- Consider field-level access logging (who viewed which member's
  detail record, and when) if your denomination or jurisdiction
  expects an audit trail for pastoral-care records.

## Compliance considerations (not legal advice)

Depending on your jurisdiction and denomination, this kind of data may
be subject to data-protection regulation (e.g. GDPR if you have EU
members, various US state privacy laws) and to your own
organization's confidentiality policies for pastoral care records.
Involve legal/compliance counsel before launch to confirm: retention
periods, a documented data-subject deletion process, and whether
notes referencing sensitive topics (health, family conflict) need
additional access restrictions beyond what's scaffolded here.

## Things intentionally left for you to decide before production

- Certificate pinning on the mobile client.
- Remote wipe / MDM integration for lost devices.
- Structured, tamper-evident audit logging beyond `sync_audit_log`.
- Automated dependency vulnerability scanning in CI.
- Penetration test before handling real congregation data.
