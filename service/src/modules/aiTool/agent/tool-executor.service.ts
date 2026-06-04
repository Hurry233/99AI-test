import { Injectable } from '@nestjs/common';
import { NetSearchService } from '../search/netSearch.service';
import { AgentTraceService } from './agent-trace.service';
import { ToolRegistryService } from './tool-registry.service';

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly toolRegistryService: ToolRegistryService,
    private readonly netSearchService: NetSearchService,
    private readonly agentTraceService: AgentTraceService,
  ) {}

  async runWebSearch(
    prompt: string,
    inputs: {
      usingNetwork?: boolean;
      onProgress?: (data: any) => void;
      onDatabase?: (data: any) => void;
    },
    result: any,
  ): Promise<{ searchResults: any[]; images: string[] }> {
    const tool = this.toolRegistryService.getTool('web_search');
    this.agentTraceService.emitToolStart(inputs.onProgress, tool);
    const output = await this.netSearchService.processNetSearch(prompt, inputs, result);
    this.agentTraceService.emitToolEnd(inputs.onProgress, tool, output);
    return output;
  }
}
