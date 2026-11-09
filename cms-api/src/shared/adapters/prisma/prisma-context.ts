import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionRunner } from '../../ports/transaction-runner.port';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Lets repositories join the caller's transaction without seeing it:
 * `TransactionRunner.run` stores the tx client in AsyncLocalStorage and every
 * Prisma repository asks `ctx.db` for the current client.
 */
export class PrismaContext implements TransactionRunner {
  private readonly als = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(readonly client: PrismaClient) {}

  get db(): Db {
    return this.als.getStore() ?? this.client;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.als.getStore()) return work(); // already inside a transaction
    return this.client.$transaction((tx) => this.als.run(tx, work));
  }
}
