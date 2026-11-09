import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from './decorators';
import { registry } from './metrics';
import { RUNTIME } from './tokens';
import type { HttpRuntime } from './runtime';
import { buildOpenApiDocument } from '../../openapi/openapi';

/** NFR-AVAIL-05 probes, Prometheus scrape, OpenAPI (FR-PUBAPI-07). */
@Controller()
@Public()
export class SystemController {
  constructor(@Inject(RUNTIME) private readonly runtime: HttpRuntime) {}

  /** Liveness: the process is up. */
  @Get('healthz')
  health(): { status: 'ok'; version: string } {
    return { status: 'ok', version: this.runtime.version };
  }

  /** Readiness: dependencies reachable. */
  @Get('readyz')
  async ready(@Res() res: Response): Promise<void> {
    const results: Record<string, string> = {};
    let ok = true;
    for (const [name, check] of Object.entries(this.runtime.readinessChecks)) {
      try {
        await check();
        results[name] = 'ok';
      } catch {
        results[name] = 'down';
        ok = false;
      }
    }
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks: results });
  }

  @Get('metrics')
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  }

  @Get('api/docs/openapi.json')
  openapi(): unknown {
    return buildOpenApiDocument(this.runtime.version);
  }

  /** Redoc viewer (served under /api/docs; nginx redirects /docs here). */
  @Get('api/docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; worker-src blob:",
  )
  docs(): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>CMS API</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><redoc spec-url="/api/docs/openapi.json"></redoc>
<script src="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js"></script></body></html>`;
  }
}
