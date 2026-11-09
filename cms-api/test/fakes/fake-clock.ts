import type { Clock } from '../../src/shared/ports/clock.port';

export class FakeClock implements Clock {
  private current: Date;

  constructor(start = '2026-05-01T09:00:00.000Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(iso: string | Date): void {
    this.current = new Date(iso);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  advanceMinutes(min: number): void {
    this.advance(min * 60_000);
  }
}
