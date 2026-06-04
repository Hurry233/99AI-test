export type ToolQuotaType = 'model3' | 'model4' | 'draw_mj' | 'none';

export interface ToolJsonSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  items?: any;
}

export interface ToolPermissions {
  roles?: string[];
  requireLogin?: boolean;
  requireMember?: boolean;
  requireRiskCheck?: boolean;
}

export interface ToolRetryPolicy {
  retries: number;
  retryDelayMs: number;
}

export interface ToolFrontendCard {
  type: string;
  title: string;
  icon?: string;
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolJsonSchema;
  outputSchema: ToolJsonSchema;
  permissions: ToolPermissions;
  quotaType: ToolQuotaType;
  estimatedCost: number;
  timeoutMs: number;
  retryPolicy: ToolRetryPolicy;
  frontendCard: ToolFrontendCard;
}

export interface ToolRunContext {
  user?: {
    id?: number | string;
    role?: string;
    packageId?: number;
    [key: string]: any;
  };
  requestId?: string;
  conversationId?: string;
  traceId?: string;
  [key: string]: any;
}

export type ToolHandler = (input: any, runContext: ToolRunContext) => Promise<any> | any;

export interface ToolExecutionTrace {
  traceId: string;
  toolName: string;
  input: any;
  outputSummary?: string;
  durationMs: number;
  cost: number;
  errorStack?: string;
  retryCount: number;
  userId?: number | string;
  requestId?: string;
  createdAt: Date;
}

export interface ToolCallResponseItem {
  type: 'tool_call';
  toolName: string;
  input: any;
  traceId: string;
  createdAt: string;
}

export interface ToolResultResponseItem {
  type: 'tool_result';
  toolName: string;
  output: any;
  outputSummary: string;
  cost: number;
  durationMs: number;
  retryCount: number;
  traceId: string;
}

export interface ToolErrorResponseItem {
  type: 'tool_error';
  toolName: string;
  error: {
    message: string;
    status?: number;
    stack?: string;
  };
  cost: number;
  durationMs: number;
  retryCount: number;
  traceId: string;
}

export type ToolResponseItem =
  | ToolCallResponseItem
  | ToolResultResponseItem
  | ToolErrorResponseItem;

export interface ToolExecutionResult {
  items: ToolResponseItem[];
  output?: any;
  error?: Error;
}
