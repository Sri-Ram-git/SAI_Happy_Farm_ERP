export function normalizeRole(role: unknown): string | null {
  if (typeof role !== 'string') return null;
  const trimmed = role.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}
