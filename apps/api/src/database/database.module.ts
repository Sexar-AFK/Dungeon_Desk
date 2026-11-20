import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Shares one Prisma client and connection pool across API modules. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
