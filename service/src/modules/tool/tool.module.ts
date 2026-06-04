import { BadWordsModule } from '@/modules/badWords/badWords.module';
import { UserBalanceModule } from '@/modules/userBalance/userBalance.module';
import { Global, Module } from '@nestjs/common';
import { AgentTraceService } from './agent-trace.service';
import { ToolExecutorService } from './tool-executor.service';
import { ToolRegistryService } from './tool-registry.service';

@Global()
@Module({
  imports: [UserBalanceModule, BadWordsModule],
  providers: [ToolRegistryService, ToolExecutorService, AgentTraceService],
  exports: [ToolRegistryService, ToolExecutorService, AgentTraceService],
})
export class ToolModule {}
