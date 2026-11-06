// Path and request guards. This server reads and writes files, so every path
// that comes from a request goes through here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_SNIPPET_BYTES = 1024 * 1024;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isInside(realRoot, realPath) {
  return realPath === realRoot || realPath.startsWith(realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep);
}

/** True when any segment of a root-relative path starts with a dot. */
export function hasDotSegment(rel) {
  return rel.split(/[\\/]/).some((s) => s.startsWith('.') && s !== '.' && s !== '');
}

/**
 * Resolve a user-supplied path (relative to root, or absolute) to a real path
 * (symlinks followed) that must lie inside the real root.
 * Throws 400 for malformed input, 404 for missing, 403 for escapes.
 */
export function resolveInside(realRoot, input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 4096) {
    throw new HttpError(400, 'bad_path', 'A path is required.');
  }
  if (input.includes('\0')) throw new HttpError(400, 'bad_path', 'That path contains an invalid character.');
  const joined = path.resolve(realRoot, input);
  let real;
  try {
    real = fs.realpathSync(joined);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      // A missing path may still be an escape attempt. Check the lexical form first.
      if (!isInside(realRoot, joined)) throw new HttpError(403, 'outside_root', 'That path is outside the project folder.');
      throw new HttpError(404, 'not_found', 'No such file or folder.');
    }
    throw new HttpError(403, 'unreadable', 'That path cannot be read.');
  }
  if (!isInside(realRoot, real)) throw new HttpError(403, 'outside_root', 'That path is outside the project folder.');
  return real;
}

/** Root-relative POSIX label for a real path inside the root ('' for the root). */
export function relLabel(realRoot, realPath) {
  return path.relative(realRoot, realPath).split(path.sep).join('/');
}

/** Constant-time string compare. */
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');
