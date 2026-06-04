import { BadWordsService } from '@/modules/badWords/badWords.service';
import { UserBalanceService } from '@/modules/userBalance/userBalance.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AgentTraceService } from './agent-trace.service';
import { ToolRegistryService } from './tool-registry.service';
import {
  ToolDefinition,
  ToolExecutionResult,
  ToolQuotaType,
  ToolRunContext,
  ToolResponseItem,
} from './tool.types';

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly toolRegistryService: ToolRegistryService,
    private readonly userBalanceService: UserBalanceService,
    private readonly badWordsService: BadWordsService,
    private readonly agentTraceService: AgentTraceService,
  ) {}

  async execute(
    toolName: string,
    input: any,
    runContext: ToolRunContext = {},
  ): Promise<ToolExecutionResult> {
    const definition = this.toolRegistryService.getDefinition(toolName);
    const handler = this.toolRegistryService.getHandler(toolName);
    if (!definition || !handler) {
      throw new HttpException(`工具未注册: ${toolName}`, HttpStatus.NOT_FOUND);
    }

    const traceId = runContext.traceId || randomUUID();
    const startedAt = Date.now();
    const items: ToolResponseItem[] = [
      {
        type: 'tool_call',
        toolName,
        input,
        traceId,
        createdAt: new Date(startedAt).toISOString(),
      },
    ];
    let retryCount = 0;
    let cost = 0;

    try {
      this.validateInput(definition, input);
      await this.validatePermissionsAndQuota(definition, input, runContext);

      const output = await this.executeWithTimeoutAndRetry(
        definition,
        () => handler(input, runContext),
        count => {
          retryCount = count;
        },
      );
      const durationMs = Date.now() - startedAt;
      const outputSummary = this.createSummary(output);
      cost = definition.estimatedCost;

      await this.chargeQuota(definition, runContext);
      await this.agentTraceService.recordToolExecution({
        traceId,
        toolName,
        input,
        outputSummary,
        durationMs,
        cost,
        retryCount,
        userId: runContext.user?.id,
        requestId: runContext.requestId,
        createdAt: new Date(),
      });

      items.push({
        type: 'tool_result',
        toolName,
        output,
        outputSummary,
        cost,
        durationMs,
        retryCount,
        traceId,
      });
      return { items, output };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const normalizedError = this.normalizeError(error);
      await this.agentTraceService.recordToolExecution({
        traceId,
        toolName,
        input,
        outputSummary: normalizedError.message,
        durationMs,
        cost,
        retryCount,
        userId: runContext.user?.id,
        requestId: runContext.requestId,
        errorStack: normalizedError.stack,
        createdAt: new Date(),
      });

      items.push({
        type: 'tool_error',
        toolName,
        error: {
          message: normalizedError.message,
          status: normalizedError.status,
          stack: normalizedError.stack,
        },
        cost,
        durationMs,
        retryCount,
        traceId,
      });
      return { items, error: normalizedError };
    }
  }

  private validateInput(definition: ToolDefinition, input: any) {
    const required = definition.inputSchema?.required || [];
    if (!input || typeof input !== 'object') {
      throw new HttpException('工具输入必须是对象', HttpStatus.BAD_REQUEST);
    }
    const missing = required.filter(field => input[field] === undefined || input[field] === null);
    if (missing.length) {
      throw new HttpException(`工具输入缺少字段: ${missing.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
  }

  private async validatePermissionsAndQuota(
    definition: ToolDefinition,
    input: any,
    runContext: ToolRunContext,
  ) {
    const permissions = definition.permissions || {};
    const user = runContext.user;
    if (permissions.requireLogin && !user?.id) {
      throw new HttpException('请先登录后再使用工具', HttpStatus.UNAUTHORIZED);
    }

    if (permissions.roles?.length && user?.role && !permissions.roles.includes(user.role)) {
      throw new HttpException('当前账号无权使用该工具', HttpStatus.FORBIDDEN);
    }

    const userId = Number(user?.id);
    if (permissions.requireRiskCheck && userId) {
      await this.badWordsService.checkBadWords(JSON.stringify(input), userId);
    }

    if (permissions.requireMember) {
      const balance = userId ? await this.userBalanceService.queryUserBalance(userId) : null;
      if (!balance?.packageId) {
        throw new HttpException('当前工具仅会员可用', HttpStatus.PAYMENT_REQUIRED);
      }
    }

    const balanceType = this.mapQuotaType(definition.quotaType);
    if (balanceType) {
      await this.userBalanceService.validateBalance(
        { user },
        balanceType,
        definition.estimatedCost,
      );
    }
  }

  private async chargeQuota(definition: ToolDefinition, runContext: ToolRunContext) {
    const balanceType = this.mapQuotaType(definition.quotaType);
    const userId = Number(runContext.user?.id);
    if (!balanceType || !userId || runContext.user?.role === 'visitor') {
      return;
    }
    await this.userBalanceService.deductFromBalance(userId, balanceType, definition.estimatedCost);
  }

  private mapQuotaType(quotaType: ToolQuotaType) {
    const mapping = {
      model3: 1,
      model4: 2,
      draw_mj: 3,
      none: 0,
    };
    return mapping[quotaType] || 0;
  }

  private async executeWithTimeoutAndRetry(
    definition: ToolDefinition,
    handler: () => Promise<any>,
    onRetry: (retryCount: number) => void,
  ) {
    const maxRetries = Math.max(definition.retryPolicy?.retries || 0, 0);
    let attempt = 0;
    let lastError: any;
    while (attempt <= maxRetries) {
      try {
        return await this.withTimeout(handler(), definition.timeoutMs);
      } catch (error) {
        lastError = error;
        if (attempt >= maxRetries) {
          break;
        }
        attempt += 1;
        onRetry(attempt);
        await this.sleep(definition.retryPolicy?.retryDelayMs || 0);
      }
    }
    throw lastError;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return promise;
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new HttpException('工具执行超时', HttpStatus.REQUEST_TIMEOUT));
      }, timeoutMs);
      promise
        .then(result => resolve(result))
        .catch(error => reject(error))
        .finally(() => clearTimeout(timer));
    });
  }

  private sleep(timeoutMs: number) {
    return new Promise(resolve => setTimeout(resolve, timeoutMs));
  }

  private createSummary(output: any) {
    const text = typeof output === 'string' ? output : JSON.stringify(output ?? null);
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  }

  private normalizeError(error: any) {
    if (error instanceof HttpException) {
      const normalized = new Error(error.message) as Error & { status?: number };
      normalized.status = error.getStatus();
      normalized.stack = error.stack;
      return normalized;
    }
    if (error instanceof Error) {
      return error as Error & { status?: number };
    }
    const normalized = new Error(String(error)) as Error & { status?: number };
    normalized.status = HttpStatus.INTERNAL_SERVER_ERROR;
    return normalized;
  }
}
