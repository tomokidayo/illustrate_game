import { randomBytes } from 'crypto';

export function nanoid(size = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars[randomBytes(1)[0] % chars.length];
  }
  return result;
}
