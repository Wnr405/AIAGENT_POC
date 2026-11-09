import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../test/fakes/fake-clock';
import {
  FakeImageProcessor,
  FakePasswordHasher,
  FakeTokenSigner,
  RecordingEmailSender,
  RecordingJobScheduler,
  SilentLogger,
} from '../../test/fakes/fakes';
import { SystemClock } from '../shared/adapters/system-clock';
import { buildMemoryInfrastructure } from './memory-infrastructure';

describe('buildMemoryInfrastructure (PERSISTENCE=memory)', () => {
  it('defaults to the system clock and an empty object store', async () => {
    const infra = buildMemoryInfrastructure({
      passwordHasher: new FakePasswordHasher(),
      tokenSigner: new FakeTokenSigner(new FakeClock()),
      emailSender: new RecordingEmailSender(),
      images: new FakeImageProcessor(),
      logger: new SilentLogger(),
      jobs: new RecordingJobScheduler(),
    });
    expect(infra.clock).toBeInstanceOf(SystemClock);
    expect(await infra.storage.head('missing')).toBeNull();
    expect(await infra.storage.readRange('missing', 4)).toEqual(new Uint8Array());
    expect(await infra.storage.read('missing')).toEqual(new Uint8Array());
  });
});
