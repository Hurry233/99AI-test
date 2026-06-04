import { Injectable, Logger } from '@nestjs/common';
import { ModelsEntity } from './models.entity';
import { ModelsService } from './models.service';

export type ModelProtocol = 'responses' | 'chat_completions';

export interface ModelCapabilities {
  supportsResponses: boolean;
  supportsVision: boolean;
  supportsImageGeneration: boolean;
  supportsTools: boolean;
  supportsJsonSchema: boolean;
  supportsReasoning: boolean;
  supportsFiles: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  pricing: any;
  rateLimit: any;
}

export interface AgentRunScenario {
  kind?: 'chat' | 'agent' | 'image' | 'title' | 'plugin';
  requiresVision?: boolean;
  requiresImageGeneration?: boolean;
  requiresTools?: boolean;
  requiresJsonSchema?: boolean;
  requiresReasoning?: boolean;
  requiresFiles?: boolean;
  preferredProtocol?: ModelProtocol;
  requestedTools?: string[];
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

export interface ModelGatewayDecision {
  model: ModelsEntity;
  protocol: ModelProtocol;
  capabilities: ModelCapabilities;
  fallbackReason: string | null;
  estimatedCost: number;
  trace: {
    requestedModel?: string;
    selectedModel: string;
    selectedModelName: string;
    protocol: ModelProtocol;
    fallbackReason: string | null;
    scenario: AgentRunScenario;
    capabilities: ModelCapabilities;
    estimatedCost: number;
  };
}

const toBoolean = (value: any, fallback = false): boolean => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  return Boolean(value);
};

const parseJson = (value: any, fallback: any) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

@Injectable()
export class ModelGatewayService {
  constructor(private readonly modelsService: ModelsService) {}

  getCapabilities(model: ModelsEntity): ModelCapabilities {
    return {
      supportsResponses: toBoolean(model.supportsResponses, false),
      supportsVision: toBoolean(model.supportsVision, Number(model.isImageUpload) > 0),
      supportsImageGeneration: toBoolean(
        model.supportsImageGeneration,
        Number(model.drawingType) > 0 || Number(model.keyType) === 2,
      ),
      supportsTools: toBoolean(model.supportsTools, toBoolean(model.isMcpTool, false)),
      supportsJsonSchema: toBoolean(model.supportsJsonSchema, false),
      supportsReasoning: toBoolean(model.supportsReasoning, Number(model.deepThinkingType) > 0),
      supportsFiles: toBoolean(model.supportsFiles, Number(model.isFileUpload) > 0),
      contextWindow: Number(model.contextWindow || model.maxModelTokens || 0),
      maxOutputTokens: Number(model.maxOutputTokens || model.max_tokens || 0),
      pricing: parseJson(model.pricing, null),
      rateLimit: parseJson(model.rateLimit, { requestsPerHour: model.modelLimits }),
    };
  }

  async selectForRun(
    requestedModel: ModelsEntity | null,
    scenario: AgentRunScenario,
  ): Promise<ModelGatewayDecision> {
    let selected = requestedModel;
    let fallbackReason: string | null = null;

    if (!selected || !this.satisfies(selected, scenario)) {
      fallbackReason = selected
        ? this.buildFallbackReason(selected, scenario)
        : '未找到请求模型，使用可满足当前场景的 fallback 模型';
      selected = await this.findFallbackModel(selected, scenario);
    }

    if (!selected) {
      selected = requestedModel;
    }

    const capabilities = this.getCapabilities(selected);
    const protocol = this.selectProtocol(capabilities, scenario);
    const estimatedCost = this.estimateCost(capabilities.pricing, scenario);

    const decision: ModelGatewayDecision = {
      model: selected,
      protocol,
      capabilities,
      fallbackReason,
      estimatedCost,
      trace: {
        requestedModel: requestedModel?.model,
        selectedModel: selected.model,
        selectedModelName: selected.modelName,
        protocol,
        fallbackReason,
        scenario,
        capabilities,
        estimatedCost,
      },
    };

    Logger.debug(`ModelGateway decision: ${JSON.stringify(decision.trace)}`, 'ModelGatewayService');
    return decision;
  }

  private selectProtocol(
    capabilities: ModelCapabilities,
    scenario: AgentRunScenario,
  ): ModelProtocol {
    if (scenario.preferredProtocol && scenario.preferredProtocol === 'responses') {
      return capabilities.supportsResponses ? 'responses' : 'chat_completions';
    }

    if (
      capabilities.supportsResponses &&
      (scenario.requiresTools ||
        scenario.requiresFiles ||
        scenario.requiresReasoning ||
        scenario.requiresJsonSchema)
    ) {
      return 'responses';
    }

    return capabilities.supportsResponses && scenario.kind === 'agent'
      ? 'responses'
      : 'chat_completions';
  }

  private satisfies(model: ModelsEntity, scenario: AgentRunScenario): boolean {
    const capabilities = this.getCapabilities(model);
    if (scenario.requiresVision && !capabilities.supportsVision) return false;
    if (scenario.requiresImageGeneration && !capabilities.supportsImageGeneration) return false;
    if (scenario.requiresTools && !capabilities.supportsTools) return false;
    if (scenario.requiresJsonSchema && !capabilities.supportsJsonSchema) return false;
    if (scenario.requiresReasoning && !capabilities.supportsReasoning) return false;
    if (scenario.requiresFiles && !capabilities.supportsFiles) return false;
    if (scenario.estimatedInputTokens && capabilities.contextWindow) {
      if (scenario.estimatedInputTokens > capabilities.contextWindow) return false;
    }
    return true;
  }

  private buildFallbackReason(model: ModelsEntity, scenario: AgentRunScenario): string {
    const misses = [];
    const capabilities = this.getCapabilities(model);
    if (scenario.requiresVision && !capabilities.supportsVision) misses.push('vision');
    if (scenario.requiresImageGeneration && !capabilities.supportsImageGeneration)
      misses.push('image_generation');
    if (scenario.requiresTools && !capabilities.supportsTools) misses.push('tools');
    if (scenario.requiresJsonSchema && !capabilities.supportsJsonSchema) misses.push('json_schema');
    if (scenario.requiresReasoning && !capabilities.supportsReasoning) misses.push('reasoning');
    if (scenario.requiresFiles && !capabilities.supportsFiles) misses.push('files');
    if (scenario.estimatedInputTokens && capabilities.contextWindow) {
      if (scenario.estimatedInputTokens > capabilities.contextWindow) misses.push('context_window');
    }
    return `请求模型 ${model.model} 不满足能力要求：${misses.join(', ')}`;
  }

  private async findFallbackModel(
    requestedModel: ModelsEntity | null,
    scenario: AgentRunScenario,
  ): Promise<ModelsEntity | null> {
    const candidates = await this.modelsService.getEnabledModels();
    const fallbackModel = requestedModel?.defaultFallbackModel;

    if (fallbackModel) {
      const configuredFallback = candidates.find(item => item.model === fallbackModel);
      if (configuredFallback && this.satisfies(configuredFallback, scenario)) {
        return configuredFallback;
      }
    }

    return candidates.find(item => this.satisfies(item, scenario)) || null;
  }

  private estimateCost(pricing: any, scenario: AgentRunScenario): number {
    const parsedPricing = parseJson(pricing, null);
    if (!parsedPricing) return 0;
    const inputRate = Number(parsedPricing.input ?? parsedPricing.inputPer1M ?? 0);
    const outputRate = Number(parsedPricing.output ?? parsedPricing.outputPer1M ?? 0);
    const inputTokens = Number(scenario.estimatedInputTokens || 0);
    const outputTokens = Number(scenario.estimatedOutputTokens || 0);
    return Number(
      ((inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate).toFixed(8),
    );
  }
}
