/**
 * Environment keys Vault secrets must never set. NODE_ENV / AUTH_DEV_BYPASS decide whether the
 * dev auth bypass is legal; NODE_* and PATH change what code the process loads.
 */
export const PROTECTED_ENV_KEYS = Object.freeze([
  'NODE_ENV', 'AUTH_DEV_BYPASS', 'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'TZ', 'PATH',
]);

/** Split a Vault secret bag into values to apply and the key NAMES (never values) that were ignored. */
export function filterSecrets(secrets) {
  const applied = {};
  const ignored = [];
  for (const [key, value] of Object.entries(secrets ?? {})) {
    if (PROTECTED_ENV_KEYS.includes(key)) ignored.push(key);
    else applied[key] = value;
  }
  return { applied, ignored };
}
