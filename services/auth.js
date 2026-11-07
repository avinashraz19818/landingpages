/**
 * Authentication & session service for the admin dashboard.
 *
 * Design notes:
 *  - Sessions are STATELESS signed tokens (expiry + HMAC), so they survive a
 *    PM2 restart without needing an external session store.
 *  - The signing key (`sessionSecret`) and the admin password live in
 *    data.json via db.js. The password is stored as sha256$<salt>$<hash>;
 *    a legacy plaintext value is transparently upgraded on first login.
 *  - Tokens travel in an httpOnly cookie because the dashboard's realtime
 *    feed uses EventSource, which cannot attach custom headers.
 */
const crypto = require('crypto');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const COOKIE_NAME = 'zfc_admin_session';

// ---------------------------------------------------------------------------
// Random secret generation
// ---------------------------------------------------------------------------
function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function isHashed(value) {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

/**
 * Constant-time comparison of a candidate password against a stored value.
 * Supports both the new scrypt format and legacy plaintext.
 *
 * @returns {{ok: boolean, needsUpgrade: boolean, upgraded?: string}}
 */
function verifyPassword(candidate, stored) {
  if (!stored) return { ok: false, needsUpgrade: false };
  if (candidate == null) return { ok: false, needsUpgrade: false };

  if (isHashed(stored)) {
    const [, salt, expected] = stored.split('$');
    if (!salt || !expected) return { ok: false, needsUpgrade: false };

    let actual;
    try {
      actual = crypto.scryptSync(String(candidate), salt, 64).toString('hex');
    } catch (e) {
      return { ok: false, needsUpgrade: false };
    }

    const a = Buffer.from(actual, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return { ok: false, needsUpgrade: false };
    return { ok: crypto.timingSafeEqual(a, b), needsUpgrade: false };
  }

  // Legacy plaintext fallback (e.g. the shipped default 'admin')
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(String(stored));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsUpgrade: ok, upgraded: ok ? hashPassword(candidate) : undefined };
}

// ---------------------------------------------------------------------------
// Signed session tokens
// ---------------------------------------------------------------------------
function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createSessionToken(sessionSecret) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, sessionSecret)}`;
}

function verifySessionToken(token, sessionSecret) {
  if (!token || !sessionSecret || typeof token !== 'string') return false;

  const idx = token.lastIndexOf('.');
  if (idx <= 0) return false;

  const payload = token.slice(0, idx);
  const providedSig = token.slice(idx + 1);

  let expectedSig;
  try {
    expectedSig = sign(payload, sessionSecret);
  } catch (e) {
    return false;
  }

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------
function sessionCookie(token, { maxAgeSeconds } = {}) {
  const parts = [
    `${COOKIE_NAME}=${token || ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict'
  ];
  parts.push(maxAgeSeconds ? `Max-Age=${maxAgeSeconds}` : 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return parts.join('; ');
}

/** Read the session token from the cookie header (EventSource can't send headers). */
function readToken(req) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const chunk of header.split(';')) {
    const eq = chunk.indexOf('=');
    if (eq === -1) continue;
    if (chunk.slice(0, eq).trim() === COOKIE_NAME) {
      return chunk.slice(eq + 1).trim() || null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Brute-force guard (in-memory; single PM2 fork instance)
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map();

function pruneAttempts() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, state] of attempts) {
    if (state.resetAt < cutoff) attempts.delete(key);
  }
}

/** @returns {{blocked: boolean, retryAfterSeconds?: number}} */
function checkLoginAllowed(ip) {
  pruneAttempts();
  const state = attempts.get(ip);
  if (!state) return { blocked: false };
  if (state.count >= MAX_ATTEMPTS) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000))
    };
  }
  return { blocked: false };
}

function registerFailedLogin(ip) {
  pruneAttempts();
  const state = attempts.get(ip) || { count: 0, resetAt: Date.now() + WINDOW_MS };
  state.count += 1;
  state.resetAt = Math.max(state.resetAt, Date.now() + WINDOW_MS);
  attempts.set(ip, state);
  return MAX_ATTEMPTS - state.count;
}

function clearLoginAttempts(ip) {
  attempts.delete(ip);
}

// ---------------------------------------------------------------------------
// Secret masking (never send full credentials to the browser)
// ---------------------------------------------------------------------------
function maskSecret(value) {
  if (!value) return null;
  const str = String(value);
  if (str.length <= 4) return '••••';
  return `••••••••${str.slice(-4)}`;
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  generateSecret,
  hashPassword,
  isHashed,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  sessionCookie,
  readToken,
  checkLoginAllowed,
  registerFailedLogin,
  clearLoginAttempts,
  maskSecret
};
