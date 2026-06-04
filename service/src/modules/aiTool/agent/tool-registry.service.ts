import { Injectable } from '@nestjs/common';

export type AgentToolName = 'web_search' | 'image_generation' | 'file_reader';

export interface AgentToolDefinition {
  name: AgentToolName;
  schema: Record<string, any>;
  permissions: string[];
  cost: {
    unit: 'free' | 'points' | 'tokens';
    estimate: number;
  };
  timeoutMs: number;
  display: {
    label: string;
    description: string;
    icon: string;
  };
}

@Injectable()
export class ToolRegistryService {
  private readonly tools: Record<AgentToolName, AgentToolDefinition> = {
    web_search: {
      name: 'web_search',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '用户提出的联网检索关键词或问题' },
        },
        required: ['query'],
      },
      permissions: ['network:read'],
      cost: { unit: 'points', estimate: 1 },
      timeoutMs: 30000,
      display: {
        label: '联网搜索',
        description: '检索最新网页内容并返回摘要、来源与图片线索',
        icon: 'web-search',
      },
    },
    image_generation: {
      name: 'image_generation',
      schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '图片生成提示词' },
          size: { type: 'string', description: '期望输出尺寸' },
          style: { type: 'string', description: '期望图片风格' },
        },
        required: ['prompt'],
      },
      permissions: ['model:image:generate'],
      cost: { unit: 'points', estimate: 4 },
      timeoutMs: 120000,
      display: {
        label: '图片生成',
        description: '根据文本提示生成图片资源',
        icon: 'image-generation',
      },
    },
    file_reader: {
      name: 'file_reader',
      schema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                type: { type: 'string' },
              },
              required: ['url'],
            },
          },
        },
        required: ['files'],
      },
      permissions: ['file:read'],
      cost: { unit: 'tokens', estimate: 0 },
      timeoutMs: 60000,
      display: {
        label: '文件阅读',
        description: '读取用户已上传的文档或图片附件上下文',
        icon: 'file-reader',
      },
    },
  };

  listTools(): AgentToolDefinition[] {
    return Object.values(this.tools);
  }

  getTool(name: AgentToolName): AgentToolDefinition {
    return this.tools[name];
  }
}
