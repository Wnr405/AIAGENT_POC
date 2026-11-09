import type { Clock } from '../ports/clock.port';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
