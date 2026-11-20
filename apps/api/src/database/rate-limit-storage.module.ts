import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { PostgresThrottlerStorage } from './postgres-throttler.storage.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [PostgresThrottlerStorage],
  exports: [PostgresThrottlerStorage],
})
export class RateLimitStorageModule {}
