import { Injectable, Logger } from '@nestjs/common';
import { ToolExecutionTrace } from './tool.types';

@Injectable()
export class AgentTraceService {
  private readonly logger = new Logger(AgentTraceService.name);
  private readonly traces: ToolExecutionTrace[] = [];
  private readonly maxInMemoryTraces = 500;

  async recordToolExecution(trace: ToolExecutionTrace) {
    this.traces.push(trace);
    if (this.traces.length > this.maxInMemoryTraces) {
      this.traces.shift();
    }

    const logPayload = {
      traceId: trace.traceId,
      toolName: trace.toolName,
      input: this.maskLargeValue(trace.input),
      outputSummary: trace.outputSummary,
      durationMs: trace.durationMs,
      cost: trace.cost,
      retryCount: trace.retryCount,
      userId: trace.userId,
      requestId: trace.requestId,
      errorStack: trace.errorStack,
    };

    if (trace.errorStack) {
      this.logger.error(JSON.stringify(logPayload), trace.errorStack);
    } else {
      this.logger.log(JSON.stringify(logPayload));
    }

    return trace;
  }

  listRecentTraces(limit = 100) {
    return this.traces.slice(-limit);
  }

  private maskLargeValue(value: any) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    if (text.length <= 2000) {
      return value;
    }
    return `${text.slice(0, 2000)}...`;
  }
}
