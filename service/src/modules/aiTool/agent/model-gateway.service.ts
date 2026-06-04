import { handleError } from '@/common/utils';
import { correctApiBaseUrl } from '@/common/utils/correctApiBaseUrl';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class ModelGatewayService {
  shouldUseResponsesApi(inputs: {
    protocol?: 'responses' | 'chat_completions';
    extraParam?: any;
    modelType?: any;
    model?: string;
  }): boolean {
    return Boolean(
      inputs?.protocol === 'responses' ||
        inputs?.extraParam?.useResponsesApi ||
        inputs?.extraParam?.tools?.length,
    );
  }

  buildResponsesRequest(messagesHistory: any[], inputs: any): Record<string, any> {
    const input = messagesHistory.map(message => ({
      role: message.role,
      content: Array.isArray(message.content)
        ? message.content.map((item: any) => {
            if (item.type === 'image_url') {
              return { type: 'input_image', image_url: item.image_url?.url || item.image_url };
            }
            return { type: 'input_text', text: item.text || item.content || String(item) };
          })
        : [
            {
              type: message.role === 'assistant' ? 'output_text' : 'input_text',
              text: message.content,
            },
          ],
    }));

    return {
      model: inputs.model,
      input,
      stream: true,
      temperature: inputs.temperature,
      max_output_tokens: inputs.max_tokens,
      tools: inputs.extraParam?.tools,
      tool_choice: inputs.extraParam?.tool_choice,
    };
  }

  async handleResponsesChat(messagesHistory: any[], inputs: any, result: any): Promise<void> {
    const openai: any = new OpenAI({
      apiKey: inputs.apiKey,
      baseURL: await correctApiBaseUrl(inputs.proxyUrl),
      timeout: inputs.timeout,
    });
    const request = this.buildResponsesRequest(messagesHistory, inputs);

    Logger.debug(`Responses请求 - Input: ${JSON.stringify(request.input)}`, 'ModelGatewayService');
    const stream = await openai.responses.create(request, {
      signal: inputs.abortController.signal,
    });

    for await (const event of stream) {
      if (inputs.abortController.signal.aborted) break;
      const delta = event?.delta || event?.text || '';
      if (event?.type === 'response.output_text.delta' && delta) {
        this.appendContent(delta, inputs, result);
      }
    }
  }

  async handleOpenAIChat(messagesHistory: any[], inputs: any, result: any): Promise<void> {
    if (this.shouldUseResponsesApi(inputs)) {
      await this.handleResponsesChat(messagesHistory, inputs, result);
      return;
    }

    const openai = new OpenAI({
      apiKey: inputs.apiKey,
      baseURL: await correctApiBaseUrl(inputs.proxyUrl),
      timeout: inputs.timeout,
    });

    try {
      Logger.debug(
        `对话请求 - Messages: ${JSON.stringify(messagesHistory)}`,
        'ModelGatewayService',
      );
      const stream = await openai.chat.completions.create(
        {
          model: inputs.model,
          messages: messagesHistory,
          stream: true,
          max_tokens: inputs.max_tokens,
          temperature: inputs.temperature,
        },
        { signal: inputs.abortController.signal },
      );

      for await (const chunk of stream) {
        if (inputs.abortController.signal.aborted) break;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) this.appendContent(content, inputs, result);
      }
    } catch (error) {
      Logger.error(`模型请求失败: ${handleError(error)}`, 'ModelGatewayService');
      throw error;
    }
  }

  private appendContent(content: string, inputs: any, result: any): void {
    result.content = [{ type: 'text', text: content }];
    result.full_content += content;
    inputs.onProgress?.({ content: result.content });
  }
}
