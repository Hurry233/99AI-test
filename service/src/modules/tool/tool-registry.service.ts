import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { BUILT_IN_TOOL_DEFINITIONS } from './tool.definitions';
import { ToolDefinition, ToolHandler, ToolRunContext } from './tool.types';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly definitions = new Map<string, ToolDefinition>();
  private readonly handlers = new Map<string, ToolHandler>();

  onModuleInit() {
    BUILT_IN_TOOL_DEFINITIONS.forEach(definition => {
      this.register(definition, this.createDefaultHandler(definition.name));
    });
  }

  register(definition: ToolDefinition, handler: ToolHandler) {
    this.validateDefinition(definition);
    this.definitions.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  getDefinition(name: string) {
    return this.definitions.get(name);
  }

  getHandler(name: string) {
    return this.handlers.get(name);
  }

  listDefinitions() {
    return Array.from(this.definitions.values());
  }

  private validateDefinition(definition: ToolDefinition) {
    const requiredKeys: Array<keyof ToolDefinition> = [
      'name',
      'description',
      'inputSchema',
      'outputSchema',
      'permissions',
      'quotaType',
      'estimatedCost',
      'timeoutMs',
      'retryPolicy',
      'frontendCard',
    ];
    const missingKey = requiredKeys.find(
      key => definition[key] === undefined || definition[key] === null,
    );
    if (missingKey) {
      throw new HttpException(`工具定义缺少字段: ${missingKey}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private createDefaultHandler(toolName: string): ToolHandler {
    return async (input: any, runContext: ToolRunContext) => ({
      status: 'registered',
      data: {
        toolName,
        input,
        requestId: runContext?.requestId,
        message: 'Tool has passed unified execution checks and is ready for provider integration.',
      },
    });
  }
}
