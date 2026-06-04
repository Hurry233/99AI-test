import { ApiProperty } from '@nestjs/swagger';

export class SetModelDto {
  @ApiProperty({ example: 1, description: 'key id', required: false })
  id: number;

  @ApiProperty({ example: 1, description: '模型类型', required: true })
  keyType: number;

  @ApiProperty({ example: '默认', description: '模型中文名称', required: true })
  modelName: string;

  @ApiProperty({ example: 'sk-', description: '模型key', required: false })
  key: any;

  @ApiProperty({
    example: true,
    description: '是否开启当前key对应的模型',
    required: true,
  })
  status: boolean;

  @ApiProperty({
    example: 'gpt-3.5',
    description: '当前key绑定的模型是多少 需要调用的模型',
    required: true,
  })
  model: string;

  @ApiProperty({ example: 1, description: '模型排序' })
  modelOrder: number;

  @ApiProperty({ example: 'https://***.png', required: false })
  modelAvatar: string;

  @ApiProperty({
    example: 4096,
    description: '模型支持的最大TOken数量',
    required: false,
  })
  maxModelTokens: number;

  @ApiProperty({
    example: true,
    description: '模型的代理地址',
    required: false,
  })
  proxyUrl: string;

  @ApiProperty({ example: 300, description: '模型超时时间', required: false })
  timeout: number;

  @ApiProperty({ example: true, description: 'key状态', required: false })
  keyStatus: number;

  @ApiProperty({
    example: true,
    description: '扣费类型 1： 普通 2： 高级余额',
    required: false,
  })
  deductType: number;

  @ApiProperty({ example: true, description: '单次扣除金额', required: false })
  deduct: number;

  @ApiProperty({
    example: true,
    description: '最大上下文轮次',
    required: false,
  })
  maxRounds: number;

  @ApiProperty({
    example: true,
    description: '是否设置为绘画Key',
    required: false,
  })
  isDraw: boolean;

  @ApiProperty({
    example: true,
    description: '是否支持文件上传',
    required: false,
  })
  isFileUpload: number;

  @ApiProperty({
    example: true,
    description: '是否使用token计费',
    required: false,
  })
  isTokenBased: boolean;

  @ApiProperty({ example: true, description: 'token计费比例', required: false })
  tokenFeeRatio: number;

  @ApiProperty({ example: true, description: '是否支持 Responses 协议', required: false })
  supportsResponses: boolean;

  @ApiProperty({ example: true, description: '是否支持视觉输入', required: false })
  supportsVision: boolean;

  @ApiProperty({ example: true, description: '是否支持图片生成', required: false })
  supportsImageGeneration: boolean;

  @ApiProperty({ example: true, description: '是否支持工具调用', required: false })
  supportsTools: boolean;

  @ApiProperty({ example: true, description: '是否支持 JSON Schema 输出', required: false })
  supportsJsonSchema: boolean;

  @ApiProperty({ example: true, description: '是否支持推理能力', required: false })
  supportsReasoning: boolean;

  @ApiProperty({ example: true, description: '是否支持文件输入', required: false })
  supportsFiles: boolean;

  @ApiProperty({ example: 128000, description: '上下文窗口 tokens', required: false })
  contextWindow: number;

  @ApiProperty({ example: 16384, description: '最大输出 tokens', required: false })
  maxOutputTokens: number;

  @ApiProperty({
    example: '{"input":2.5,"output":10}',
    description: '模型价格 JSON',
    required: false,
  })
  pricing: string;

  @ApiProperty({ example: '{"requestsPerMinute":60}', description: '限流 JSON', required: false })
  rateLimit: string;

  @ApiProperty({ example: 'gpt-4.1-mini', description: '默认 fallback 模型', required: false })
  defaultFallbackModel: string;

  @ApiProperty({
    example: '["web_search","mcp"]',
    description: '工具允许列表 JSON',
    required: false,
  })
  allowedTools: string;

  @ApiProperty({ example: 4096, description: '模型最大回复 token 数', required: false })
  max_tokens: number;

  @ApiProperty({ example: true, description: '是否支持图片上传', required: false })
  isImageUpload: number;

  @ApiProperty({ example: 50, description: '模型频率限制', required: false })
  modelLimits: number;

  @ApiProperty({ example: '适合复杂任务', description: '模型描述', required: false })
  modelDescription: string;

  @ApiProperty({ example: true, description: '是否开启联网搜索', required: false })
  isNetworkSearch: boolean;

  @ApiProperty({ example: 0, description: '深度思考类型', required: false })
  deepThinkingType: number;

  @ApiProperty({ example: 1, description: '深度思考扣费系数', required: false })
  deductDeepThink: number;

  @ApiProperty({ example: true, description: '是否支持 MCP 工具', required: false })
  isMcpTool: boolean;

  @ApiProperty({ example: '', description: '模型 system 预设', required: false })
  systemPrompt: string;

  @ApiProperty({ example: 0, description: '预设类型', required: false })
  systemPromptType: number;

  @ApiProperty({ example: 0, description: '绘画类型', required: false })
  drawingType: number;
}
