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
        inputs?.extraParam?.tools?.length ||
        inputs?.extraParam?.imageEditInputs?.length,
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

    const imageEditInputs = inputs.extraParam?.imageEditInputs || [];
    if (imageEditInputs.length && input.length) {
      const lastUserMessage = [...input].reverse().find((message: any) => message.role === 'user');
      if (lastUserMessage) {
        lastUserMessage.content = [...imageEditInputs, ...lastUserMessage.content];
      }
    }

    return {
      model: inputs.model,
      input,
      stream: true,
      temperature: inputs.temperature,
      max_output_tokens: inputs.max_tokens,
      tools:
        inputs.extraParam?.tools || (imageEditInputs.length ? [{ type: 'image_generation' }] : undefined),
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
    if (inputs.extraParam?.responseFormat) request.response_format = inputs.extraParam.responseFormat;
    if (inputs.extraParam?.size) request.size = inputs.extraParam.size;
    if (inputs.extraParam?.quality) request.quality = inputs.extraParam.quality;

    if (inputs.extraParam?.imageEditInputs?.length) {
      request.stream = false;
      const response = await openai.responses.create(request, {
        signal: inputs.abortController.signal,
      });
      result.raw_response = response;
      result.response_items = response.output || [];
      result.full_content = response.output_text || '';
      inputs.onProgress?.({
        response_items: result.response_items,
        content: result.full_content ? [{ type: 'text', text: result.full_content }] : undefined,
      });
      return;
    }

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
