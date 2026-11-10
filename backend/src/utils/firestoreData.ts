/**
 * Firestore rejects `undefined` anywhere in a document ("Cannot use "undefined" as a Firestore
 * value"). This returns a copy of `value` that Firestore will accept:
 * - object properties whose value is `undefined` are omitted;
 * - `undefined` array elements become `null` (keeps array positions stable).
 *
 * Only plain objects and arrays are traversed. Anything else (Firestore Timestamps, FieldValue
 * sentinels, DocumentReferences, Dates) is returned unchanged.
 */
export function stripUndefined<T>(value: T): T {
  return strip(value) as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : strip(item)));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = strip(item);
    }
    return out;
  }
  return value;
}
