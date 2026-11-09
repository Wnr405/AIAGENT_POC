export interface JobScheduler {
  enqueue(name: string, payload: Record<string, unknown>): Promise<void>;
}
