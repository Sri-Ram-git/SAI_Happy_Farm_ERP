import { describe, it, expect } from 'vitest';
import { generateRequestId } from '../utils/requestId';

describe('Request ID', () => {
  it('should generate a unique ID', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
  });

  it('should generate UUID format', () => {
    const id = generateRequestId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });
});
