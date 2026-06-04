import { Injectable } from '@nestjs/common';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
}

@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerWebSearch();
  }

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
    return tool;
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  listTools() {
    return Array.from(this.tools.values());
  }

  private registerWebSearch() {
    this.register({
      name: 'web_search',
      description:
        'Search the web for current or rapidly changing information and return normalized citation-ready results.',
      input_schema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The exact user-facing search query.',
          },
        },
      },
      output_schema: {
        type: 'object',
        required: [
          'query',
          'title',
          'url',
          'snippet',
          'publishedAt',
          'sourceType',
          'confidence',
          'citationId',
        ],
        properties: {
          query: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          snippet: { type: 'string' },
          publishedAt: { type: ['string', 'null'], format: 'date-time' },
          sourceType: {
            type: 'string',
            enum: ['legacy_net_search', 'responses_hosted_web_search', 'unknown'],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          citationId: { type: 'string' },
        },
      },
    });
  }
}
