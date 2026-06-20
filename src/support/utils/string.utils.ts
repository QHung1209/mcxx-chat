import { uuidv7 } from 'uuidv7';

export function generateProcessId(): string {
  return uuidv7();
}
