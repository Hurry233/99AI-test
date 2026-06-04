import { Injectable } from '@nestjs/common';
import { AgentToolDefinition } from './tool-registry.service';

@Injectable()
export class AgentTraceService {
  emitProgress(onProgress: ((data: any) => void) | undefined, data: any): void {
    onProgress?.(data);
  }

  emitToolStart(onProgress: ((data: any) => void) | undefined, tool: AgentToolDefinition): void {
    onProgress?.({
      event: 'tool_start',
      tool: tool.name,
      display: tool.display,
    });
  }

  emitToolEnd(
    onProgress: ((data: any) => void) | undefined,
    tool: AgentToolDefinition,
    output: any,
  ): void {
    onProgress?.({
      event: 'tool_end',
      tool: tool.name,
      display: tool.display,
      output,
    });
  }
}
