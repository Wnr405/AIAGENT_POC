import type { TransactionRunner } from '../ports/transaction-runner.port';

/** For in-memory persistence: no real transaction, just runs the work. */
export class NoopTransactionRunner implements TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
