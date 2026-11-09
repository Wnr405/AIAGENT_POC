import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuditController } from '../modules/audit/adapters/in/http/audit.controller';
import { ApiKeysController, AuthController } from '../modules/auth/adapters/in/http/auth.controller';
import { ContentController } from '../modules/content/adapters/in/http/content.controller';
import { DevStorageController } from '../modules/media/adapters/in/http/dev-storage.controller';
import { MediaController } from '../modules/media/adapters/in/http/media.controller';
import { PublicContentController } from '../modules/public-api/adapters/in/http/public.controller';
import { UsersController } from '../modules/users/adapters/in/http/users.controller';
import { DomainErrorFilter } from '../shared/http/error.filter';
import { ApiKeyGuard, JwtAuthGuard, RateLimitGuard, RolesGuard } from '../shared/http/guards';
import type { HttpRuntime } from '../shared/http/runtime';
import { SystemController } from '../shared/http/system.controller';
import { CONTAINER, RUNTIME } from '../shared/http/tokens';
import type { Container } from './container';

/**
 * Nest is only the HTTP shell: every controller receives the framework-free
 * container built in container.ts. Guard order matters: auth → roles → rate limit.
 */
@Module({})
export class AppModule {
  static forRoot(container: Container, runtime: HttpRuntime): DynamicModule {
    const controllers = [
      SystemController,
      AuthController,
      ApiKeysController,
      UsersController,
      ContentController,
      MediaController,
      AuditController,
      PublicContentController,
      ...(runtime.persistence === 'memory' ? [DevStorageController] : []),
    ];
    return {
      module: AppModule,
      controllers,
      providers: [
        { provide: CONTAINER, useValue: container },
        { provide: RUNTIME, useValue: runtime },
        ApiKeyGuard,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_FILTER, useClass: DomainErrorFilter },
      ],
    };
  }
}
