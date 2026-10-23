// utils/error-messages.ts

/**
 * Single source of truth for turning any thrown value into short, plain copy
 * that is safe to put in front of a user.
 *
 * Invariant: no function here can return transport noise, SDK error names,
 * internal codes, stack frames, or backend internals. Anything unrecognised
 * collapses to generic copy rather than being passed through.
 */

export type ErrorKind =
  | 'offline'
  | 'timeout'
  | 'socket'
  | 'session'
  | 'server'
  | 'suspended'
  | 'ratelimit'
  | 'filesize'
  | 'filetype'
  | 'permission'
  | 'exists'
  | 'notfound'
  | 'busy'
  | 'validation'
  | 'unknown';

export interface UserError {
  title: string;
  message: string;
}

export interface ResolvedCopy extends UserError {
  kind: ErrorKind;
}

export const DEFAULT_FALLBACK =
  'Something went wrong. Please check your connection and try again.';

export const COPY: Record<ErrorKind, UserError> = {
  offline: {
    title: 'No Connection',
    message:
      'We could not reach the server. Please check your internet connection and try again.',
  },
  timeout: {
    title: 'Taking a While',
    message: 'That took too long. Please try again in a moment.',
  },
  socket: {
    title: 'Connection Interrupted',
    message: 'We lost the connection. Please try again.',
  },
  session: {
    title: 'Session Expired',
    message: 'Your session has expired. Please log in again.',
  },
  server: {
    title: 'Something Went Wrong',
    message: 'Something went wrong on our end. Please try again in a moment.',
  },
  suspended: {
    title: 'Account Suspended',
    message:
      'This account is not available right now. Please contact support if you need help.',
  },
  ratelimit: {
    title: 'Slow Down',
    message: 'Too many attempts. Please wait a moment and try again.',
  },
  filesize: {
    title: 'File Too Large',
    message: 'That file is too large. Please choose a smaller one.',
  },
  filetype: {
    title: 'Unsupported File',
    message: 'That file type is not supported. Please try a different one.',
  },
  permission: {
    title: "Can't Do That",
    message: 'You do not have permission to do that.',
  },
  exists: {
    title: 'Already Exists',
    message: 'That already exists. Please try something different.',
  },
  notfound: {
    title: 'Not Found',
    message: "We couldn't find what you were looking for.",
  },
  busy: {
    title: 'No One Available',
    message: 'Everyone is busy right now. Please try again in a little while.',
  },
  validation: {
    title: "Couldn't Complete That",
    message: 'Please check the details you entered and try again.',
  },
  unknown: {
    title: 'Something Went Wrong',
    message: 'Something went wrong. Please try again.',
  },
};

const HARD_RULES: [ErrorKind, RegExp][] = [
  [
    'offline',
    /AuthRetryableFetchError|network request failed|network[_ ]error|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|failed to fetch|fetch failed|unable to resolve host|ENOTFOUND|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN|EPIPE|TypeError:\s*network|you (are|were) offline|no internet|isOffline/i,
  ],
  [
    'timeout',
    /ETIMEDOUT|ESOCKETTIMEDOUT|ERR_CONNECTION_TIMED_OUT|\btimeout|timed out|taking too long/i,
  ],
  [
    'socket',
    /websocket|xhr poll|socket hang|transport (close|error|open|upgrade)|engine\.io|bad handshake|handshake|upgrade rejected|\b50[234]\b/i,
  ],
  [
    'server',
    /not configured|misconfigured|unavailable on the server|not set up/i,
  ],
  [
    'session',
    /\bjwt\b|\b401\b|\bauthentication\b|apikey|api key|signature (does not )?match|invalid (refresh |access )?token|token (is )?(expired|invalid)|session (has )?expired|refresh token|not authenticated/i,
  ],
  [
    'server',
    /AuthApiError|not configured|misconfigured|unavailable on the server|internal server error|server error|\b500\b|overloaded|supabase|postgres|row-level security|mongodb|mongoose|query failed|deadlock|buffer(ing)? timed out|memory (leak|exhausted)|INTERNAL_ERROR|LIMIT_FILE_SIZE/i,
  ],
];

const SOFT_RULES: [ErrorKind, RegExp][] = [
  ['suspended', /suspend|account (is )?(disabled|blocked|banned)|banned/i],
  ['ratelimit', /rate limit|too many (requests|attempts)|slow down|\b429\b/i],
  [
    'filesize',
    /file (is )?too large|exceeds? (the )?(allowed|maximum|size)|payload too large|entity too large|\b413\b/i,
  ],
  [
    'filetype',
    /unsupported (file|media|image|type)|invalid file type|only image|not a valid (file|image|video)/i,
  ],
  [
    'exists',
    /already (exists|registered|taken|been used|joined)|duplicate (key|value)|username is taken|\b409\b|e11000/i,
  ],
  ['notfound', /not found|\b404\b|does not exist|no longer (available|exists)|could not find/i],
  [
    'permission',
    /unauthorized|unauthorised|not authorized|not authorised|forbidden|denied|not allowed|only admin|not permitted|must be a member|\b403\b/i,
  ],
  ['busy', /busy|matching|in queue|no peers|everyone is (busy|on a call)/i],
  [
    'offline',
    /network|connection|unreachable|gateway|connect(ion)? (refused|failed|closed|reset)|offline/i,
  ],
  [
    'validation',
    /invalid|is required|are required|must (be|have|contain)|too (short|long)|validation|does not match/i,
  ],
];

const TECHNICAL_PATTERNS: RegExp[] = [  /\bat\s+\w+\s+\(/,
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/i,
  /\bnode_modules\b/i,
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/,
  /\bE[A-Z]{3,}\b/,
  /\b(?:ECONN|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|EPIPE|ERR_)[A-Z_]*\b/,
  /MongoServerError|MongooseError|MongoError|ValidationError|CastError|ObjectId|PostgresError/i,
  /\b[A-Z][A-Za-z]*(?:Error|Exception|Timeout|Refused|Reset|Unreachable|Disconnected)\b/,
  /\b[a-z]+(?:_[a-z0-9]+){1,}\b/,
  /<[a-z/][^>]*>|\{\{|\[\[|[{}]/,
  /\bundefined\b|\bNaN\b/i,
];

const STATUS_KIND: Record<number, ErrorKind> = {
  400: 'validation',
  401: 'session',
  403: 'permission',
  404: 'notfound',
  409: 'exists',
  413: 'filesize',
  415: 'filetype',
  422: 'validation',
  429: 'ratelimit',
};

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function readText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return collapse(value);
  if (typeof value !== 'object') return '';
  const err = value as Record<string, any>;
  return collapse(
    firstString(
      err.message,
      err.description,
      err.context?.description,
      err.data?.msg,
      err.data?.message,
      err.err?.message
    )
  );
}

/**
 * True when the text is shaped like internal/transport output rather than a
 * sentence written for a person.
 */
export function isTechnicalText(value: unknown): boolean {
  const text = readText(value);
  if (!text) return false;
  if (text.length > 140) return true;
  if (/[\n\r\t]/.test(text)) return true;
  if (/\S{40,}/.test(text)) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * True when the text reads like something a person wrote for another person.
 */
export function looksLikeUserCopy(value: unknown): boolean {
  const text = readText(value);
  if (text.length < 4 || text.length > 140) return false;
  if (isTechnicalText(text)) return false;
  if (!/[a-z]{3}/i.test(text)) return false;
  if (/[:]$]/.test(text.slice(0, 1))) return false;
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 30) return false;
  if (words.length === 1) return /^[A-Za-z][A-Za-z'-]{2,19}$/.test(text);
  return true;
}

function matchRule(rules: [ErrorKind, RegExp][], text: string): ErrorKind | null {
  const found = rules.find(([, pattern]) => pattern.test(text));
  return found ? found[0] : null;
}

/**
 * Classifies raw text into a known failure family, or `null` when it is
 * ordinary human copy we are happy to show.
 */
export function classifyText(value: unknown): ErrorKind | null {
  const text = readText(value);
  if (!text) return null;
  return matchRule(HARD_RULES, text) ?? matchRule(SOFT_RULES, text);
}

/**
 * Classifies any thrown value, including HTTP responses.
 */
export function classifyError(error: unknown): ErrorKind {
  const err = error as Record<string, any> | null | undefined;
  if (err?.isNetworkError === true) return 'offline';

  const status = err?.response?.status;
  if (typeof status === 'number' && status >= 500) return 'server';

  const serverText = firstString(
    err?.response?.data?.msg,
    err?.response?.data?.message,
    err?.response?.data?.error,
    err?.data?.msg,
    err?.description
  );

  return classifyText(serverText) ?? classifyText(error) ?? 'unknown';
}

/**
 * Resolves raw text into safe copy. Known technical families are replaced,
 * plain human copy is kept, and anything else uses the caller's fallback.
 */
export function resolveCopy(
  value: unknown,
  fallback: string = COPY.unknown.message
): ResolvedCopy {
  const text = readText(value);

  if (!text) {
    return { kind: 'unknown', ...COPY.unknown, message: fallback };
  }

  const hard = matchRule(HARD_RULES, text);
  if (hard) {
    return { kind: hard, ...COPY[hard] };
  }

  if (looksLikeUserCopy(text)) {
    return { kind: 'unknown', title: COPY.unknown.title, message: text };
  }

  const soft = matchRule(SOFT_RULES, text);
  if (soft) {
    return { kind: soft, ...COPY[soft] };
  }

  return { kind: 'unknown', ...COPY.unknown, message: fallback };
}

/**
 * Safe message text for an alert body.
 */
export function toUserCopy(value: unknown, fallback: string = COPY.unknown.message): string {
  return resolveCopy(value, fallback).message;
}

/**
 * Reads the backend's `msg` / `message` / `error` field and returns it only
 * when it is safe to display. Drop-in replacement for raw `data?.msg` reads.
 */
export function serverText(data: unknown, fallback: string = COPY.unknown.message): string {
  const body = (data ?? {}) as Record<string, any>;
  return toUserCopy(
    firstString(body.msg, body.message, body.error),
    fallback
  );
}

function looksLikeNetworkFailure(error: unknown): boolean {
  const err = (error ?? {}) as Record<string, any>;
  if (err.isNetworkError === true) return true;
  const text = collapse(
    firstString(err.message, err.code, err.name, err.err?.message)
  );
  if (!text) return false;
  return (
    matchRule(HARD_RULES, text) === 'offline' ||
    matchRule(HARD_RULES, text) === 'timeout' ||
    matchRule(HARD_RULES, text) === 'socket'
  );
}

export interface ToUserErrorOptions {
  /** Overrides the detected HTTP status. */
  status?: number;
  /** Action-specific copy used when nothing safer applies. */
  fallback?: string;
  /** Forces the alert title. */
  title?: string;
}

/**
 * Turns any thrown value into a title and message that are always safe to
 * show. Prefer this over reading `error.message` or `response.data.msg`.
 */
export function toUserError(
  error: unknown,
  options: ToUserErrorOptions = {}
): UserError {
  const err = (error ?? {}) as Record<string, any>;
  const status = options.status ?? err?.response?.status;
  const fallback = options.fallback ?? DEFAULT_FALLBACK;

  if (err?.response && typeof status === 'number') {
    const kind = STATUS_KIND[status] ?? (status >= 500 ? 'server' : 'unknown');
    const base = COPY[kind];
    const serverRaw = firstString(
      err.response.data?.msg,
      err.response.data?.message,
      err.response.data?.error
    );
    const resolved = serverRaw
      ? resolveCopy(serverRaw, base.message)
      : { kind, ...base };

    return {
      title: options.title ?? resolved.title,
      message: resolved.message,
    };
  }

  if (err?.request || looksLikeNetworkFailure(error)) {
    const raw = readText(error);
    const kind: ErrorKind =
      matchRule(HARD_RULES, raw) === 'timeout' ? 'timeout' : 'offline';
    return { title: options.title ?? COPY[kind].title, message: COPY[kind].message };
  }

  const raw = firstString(
    typeof error === 'string' ? error : '',
    err.message,
    err.data?.msg,
    err.data?.message,
    err.err?.message,
    err.description
  );
  const resolved = resolveCopy(raw, fallback);

  return { title: options.title ?? resolved.title, message: resolved.message };
}
