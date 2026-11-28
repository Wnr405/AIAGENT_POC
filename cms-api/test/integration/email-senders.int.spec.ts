import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleEmailSender, SmtpEmailSender } from '../../src/modules/notifications/adapters/out/email/email-senders';

/**
 * Outbound email adapters (06-TEST-STRATEGY §7.5). The SMTP sender talks to a minimal in-process
 * SMTP server, so the real nodemailer client is exercised end to end without a container.
 */
interface Received {
  from: string;
  to: string[];
  data: string;
}

const addressIn = (line: string) => /<([^>]*)>/.exec(line)?.[1] ?? '';

/** One SMTP session: commands until DATA, then the message until <CRLF>.<CRLF>. */
class FakeSmtpSession {
  private mail: Received = { from: '', to: [], data: '' };
  private inData = false;
  private buffer = '';
  private readonly commands: Record<string, (line: string) => string> = {
    EHLO: () => '250 fake-smtp',
    HELO: () => '250 fake-smtp',
    MAIL: (line) => {
      this.mail.from = addressIn(line);
      return '250 OK';
    },
    RCPT: (line) => {
      this.mail.to.push(addressIn(line));
      return '250 OK';
    },
    DATA: () => {
      this.inData = true;
      return '354 End data with <CR><LF>.<CR><LF>';
    },
    RSET: () => '250 OK',
    NOOP: () => '250 OK',
    QUIT: () => {
      setImmediate(() => this.socket.end());
      return '221 Bye';
    },
  };

  constructor(
    private readonly socket: Socket,
    private readonly received: Received[],
  ) {
    this.reply('220 fake-smtp ready');
    socket.on('data', (chunk: Buffer) => this.onData(chunk.toString('utf8')));
  }

  private reply(line: string): void {
    this.socket.write(`${line}\r\n`);
  }

  private onData(text: string): void {
    this.buffer += text;
    for (let progressed = true; progressed;) progressed = this.inData ? this.takeMessage() : this.takeCommand();
  }

  private takeMessage(): boolean {
    const end = this.buffer.indexOf('\r\n.\r\n');
    if (end === -1) return false;
    this.received.push({ ...this.mail, data: this.buffer.slice(0, end) });
    this.mail = { from: '', to: [], data: '' };
    this.buffer = this.buffer.slice(end + 5);
    this.inData = false;
    this.reply('250 OK: queued');
    return true;
  }

  private takeCommand(): boolean {
    const eol = this.buffer.indexOf('\r\n');
    if (eol === -1) return false;
    const line = this.buffer.slice(0, eol);
    this.buffer = this.buffer.slice(eol + 2);
    const handler = this.commands[line.slice(0, 4).toUpperCase()];
    this.reply(handler ? handler(line) : '502 Command not implemented');
    return true;
  }
}

const fakeSmtp = (received: Received[]): Server => createServer((socket) => new FakeSmtpSession(socket, received));

describe('SmtpEmailSender (integration)', () => {
  const received: Received[] = [];
  const server = fakeSmtp(received);
  let port: number;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  beforeEach(() => {
    received.length = 0;
  });

  it('FR-USER-02/FR-AUTH-07: delivers the invite/reset email over SMTP with text and HTML parts', async () => {
    const sender = new SmtpEmailSender({ host: '127.0.0.1', port, secure: false }, 'CMS <no-reply@cms.test>');

    await sender.send({
      to: 'editor@cms.test',
      subject: 'Set your password',
      text: 'Open https://cms.test/set-password?token=abc',
      html: '<p>Open <a href="https://cms.test/set-password?token=abc">this link</a></p>',
    });

    expect(received).toHaveLength(1);
    const [mail] = received;
    expect(mail?.from).toBe('no-reply@cms.test');
    expect(mail?.to).toEqual(['editor@cms.test']);
    expect(mail?.data).toMatch(/^Subject: Set your password\r?$/m);
    expect(mail?.data).toMatch(/^To: editor@cms\.test\r?$/m);
    expect(mail?.data).toMatch(/Content-Type: text\/plain/);
    expect(mail?.data).toMatch(/Content-Type: text\/html/);
    expect(mail?.data).toContain('set-password?token=abc');
  });

  it('FR-USER-02: rejects when the SMTP relay cannot be reached', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const deadPort = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const sender = new SmtpEmailSender({ host: '127.0.0.1', port: deadPort, secure: false }, 'no-reply@cms.test');

    await expect(sender.send({ to: 'a@cms.test', subject: 's', text: 't', html: '<p>t</p>' })).rejects.toThrow();
  });
});

describe('ConsoleEmailSender', () => {
  it('FR-USER-02: logs the email (with its link) instead of sending it, for development', async () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await new ConsoleEmailSender(logger).send({
      to: 'a@cms.test',
      subject: 'Reset',
      text: 'link',
      html: '<p>link</p>',
    });
    expect(logger.info).toHaveBeenCalledWith('DEV EMAIL (not sent)', {
      devEmail: { to: 'a@cms.test', subject: 'Reset', text: 'link' },
    });
  });
});
