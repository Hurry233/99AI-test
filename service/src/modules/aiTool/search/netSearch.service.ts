import { handleError } from '@/common/utils';
import { Injectable, Logger } from '@nestjs/common';
import fetch from 'cross-fetch';
import { GlobalConfigService } from '../../globalConfig/globalConfig.service';

export interface UnifiedSearchResult {
  query: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
  sourceType: 'legacy_net_search' | 'responses_hosted_web_search' | 'unknown';
  confidence: number;
  citationId: string;
  resultIndex: number;
  icon?: string;
  media?: string;
}

export type UnifiedResponseItem =
  | {
      type: 'tool_call';
      tool_name: 'web_search';
      query: string;
      startedAt: string;
      completedAt?: string;
    }
  | {
      type: 'tool_result';
      tool_name: 'web_search';
      query: string;
      results: UnifiedSearchResult[];
      latencyMs: number;
      sourceCount: number;
    }
  | {
      type: 'citation';
      citationId: string;
      title: string;
      url: string;
      snippet: string;
      publishedAt: string | null;
      sourceType: UnifiedSearchResult['sourceType'];
      confidence: number;
    };

export interface SearchTrace {
  query: string;
  latencyMs: number;
  sourceCount: number;
  finalCitationUrls: string[];
  failureReason?: string;
}

@Injectable()
export class NetSearchService {
  constructor(private readonly globalConfigService: GlobalConfigService) {}

  /**
   * 处理网络搜索流程
   * @param prompt 搜索关键词
   * @param inputs 输入参数
   * @param result 结果对象
   * @returns 搜索结果对象
   */
  async processNetSearch(
    prompt: string,
    inputs: {
      usingNetwork?: boolean;
      onProgress?: (data: any) => void;
      onDatabase?: (data: any) => void;
    },
    result: any,
  ): Promise<{
    searchResults: UnifiedSearchResult[];
    images: string[];
    response_items: UnifiedResponseItem[];
    trace: SearchTrace;
    error?: string;
  }> {
    const { usingNetwork, onProgress, onDatabase } = inputs;
    let searchResults: UnifiedSearchResult[] = [];
    let images: string[] = [];
    const startedAt = Date.now();
    const response_items: UnifiedResponseItem[] = [
      {
        type: 'tool_call',
        tool_name: 'web_search',
        query: prompt,
        startedAt: new Date(startedAt).toISOString(),
      },
    ];

    // 如果不使用网络搜索，直接返回空结果
    if (!usingNetwork) {
      return {
        searchResults,
        images,
        response_items: [],
        trace: {
          query: prompt,
          latencyMs: 0,
          sourceCount: 0,
          finalCitationUrls: [],
          failureReason: 'search_disabled',
        },
      };
    }

    try {
      Logger.log(`[网络搜索] 开始搜索: ${prompt}`, 'NetSearchService');

      // 调用网络搜索服务
      const searchResponse = await this.webSearchPro(prompt);
      searchResults = this.normalizeLegacyResults(prompt, searchResponse.searchResults);
      images = searchResponse.images;

      Logger.log(
        `[网络搜索] 完成，获取到 ${searchResults.length} 条结果和 ${images.length} 张图片`,
        'NetSearchService',
      );

      const latencyMs = Date.now() - startedAt;
      const trace: SearchTrace = {
        query: prompt,
        latencyMs,
        sourceCount: searchResults.length,
        finalCitationUrls: searchResults.map(item => item.url).filter(Boolean),
        failureReason: searchResults.length === 0 ? 'no_search_results' : undefined,
      };

      response_items[0] = {
        ...response_items[0],
        completedAt: new Date().toISOString(),
      } as UnifiedResponseItem;
      response_items.push({
        type: 'tool_result',
        tool_name: 'web_search',
        query: prompt,
        results: searchResults,
        latencyMs,
        sourceCount: searchResults.length,
      });
      response_items.push(
        ...searchResults.map(item => ({
          type: 'citation' as const,
          citationId: item.citationId,
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          publishedAt: item.publishedAt,
          sourceType: item.sourceType,
          confidence: item.confidence,
        })),
      );

      // 更新结果对象
      result.networkSearchResult = JSON.stringify(searchResults);
      result.response_items = response_items;
      result.searchTrace = trace;
      result.tool_calls = JSON.stringify({
        response_items,
        searchTrace: trace,
      });
      onProgress?.({
        networkSearchResult: result.networkSearchResult,
      });

      // 存储数据到数据库
      onDatabase?.({
        networkSearchResult: JSON.stringify(searchResults, null, 2),
        response_items,
        searchTrace: trace,
      });

      return {
        searchResults,
        images,
        response_items,
        trace,
      };
    } catch (error) {
      Logger.error(`[网络搜索] 失败: ${handleError(error)}`, 'NetSearchService');

      // 即时存储错误信息
      onDatabase?.({
        searchTrace: {
          query: prompt,
          latencyMs: Date.now() - startedAt,
          sourceCount: 0,
          finalCitationUrls: [],
          failureReason: handleError(error),
        },
        network_search_error: {
          error: handleError(error),
          query: prompt,
          timestamp: new Date(),
        },
      });

      return {
        searchResults: [],
        images: [],
        response_items: [],
        trace: {
          query: prompt,
          latencyMs: Date.now() - startedAt,
          sourceCount: 0,
          finalCitationUrls: [],
          failureReason: handleError(error),
        },
        error: handleError(error),
      };
    }
  }

  mergeResponseItems(
    legacyResults: UnifiedSearchResult[],
    hostedResponseItems: any[] = [],
    query = '',
    latencyMs = 0,
  ): UnifiedResponseItem[] {
    const hostedResults = this.normalizeHostedResponseItems(query, hostedResponseItems);
    const results = this.dedupeResults([...legacyResults, ...hostedResults]);

    return [
      {
        type: 'tool_call',
        tool_name: 'web_search',
        query,
        startedAt: new Date(Date.now() - latencyMs).toISOString(),
        completedAt: new Date().toISOString(),
      },
      {
        type: 'tool_result',
        tool_name: 'web_search',
        query,
        results,
        latencyMs,
        sourceCount: results.length,
      },
      ...results.map(item => ({
        type: 'citation' as const,
        citationId: item.citationId,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
        sourceType: item.sourceType,
        confidence: item.confidence,
      })),
    ];
  }

  normalizeLegacyResults(query: string, results: any[] = []): UnifiedSearchResult[] {
    return this.dedupeResults(
      results.map((item, index) => ({
        query,
        title: item?.title || '',
        url: item?.url || item?.link || '',
        snippet: item?.snippet || item?.content || '',
        publishedAt: item?.publishedAt || item?.published_at || item?.date || null,
        sourceType: 'legacy_net_search' as const,
        confidence: typeof item?.score === 'number' ? Math.max(0, Math.min(1, item.score)) : 0.7,
        citationId: item?.citationId || String(item?.resultIndex || index + 1),
        resultIndex: item?.resultIndex || index + 1,
        icon: item?.icon || '',
        media: item?.media || '',
      })),
    );
  }

  normalizeHostedResponseItems(query: string, responseItems: any[] = []): UnifiedSearchResult[] {
    const results: UnifiedSearchResult[] = [];

    responseItems.forEach((item, index) => {
      const candidates = item?.results || item?.content || item?.annotations || [];
      const list = Array.isArray(candidates) ? candidates : [candidates];

      list.forEach((candidate, candidateIndex) => {
        const url =
          candidate?.url || candidate?.link || candidate?.web_url || candidate?.source?.url;
        if (!url) {
          return;
        }

        const resultIndex = results.length + 1;
        results.push({
          query,
          title: candidate?.title || candidate?.source?.title || url,
          url,
          snippet: candidate?.snippet || candidate?.text || candidate?.content || '',
          publishedAt: candidate?.publishedAt || candidate?.published_at || null,
          sourceType: 'responses_hosted_web_search',
          confidence:
            typeof candidate?.confidence === 'number'
              ? Math.max(0, Math.min(1, candidate.confidence))
              : 0.8,
          citationId: candidate?.citationId || `h${index + 1}-${candidateIndex + 1}`,
          resultIndex,
        });
      });
    });

    return this.dedupeResults(results);
  }

  private dedupeResults(results: UnifiedSearchResult[]) {
    const seen = new Set<string>();
    return results.filter(item => {
      const key = item.url || `${item.title}:${item.snippet}`;
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async webSearchPro(prompt: string) {
    try {
      const { pluginUrl, pluginKey } = await this.globalConfigService.getConfigs([
        'pluginUrl',
        'pluginKey',
      ]);

      if (!pluginUrl || !pluginKey) {
        Logger.warn('搜索插件配置缺失');
        return { searchResults: [], images: [] };
      }

      // 如果有多个 key，随机选择一个
      const keys = pluginKey.split(',').filter(key => key.trim());
      const selectedKey = keys[Math.floor(Math.random() * keys.length)];

      const isBochaiApi = pluginUrl.includes('bochaai.com');
      const isBigModelApi = pluginUrl.includes('bigmodel.cn');
      const isTavilyApi = pluginUrl.includes('tavily.com');

      Logger.log(
        `[搜索] API类型: ${
          isBochaiApi ? 'Bochai' : isBigModelApi ? 'BigModel' : isTavilyApi ? 'Tavily' : '未知'
        }`,
      );
      Logger.log(`[搜索] 请求URL: ${pluginUrl}`);
      Logger.log(`[搜索] 搜索关键词: ${prompt}`);

      const requestBody = isBochaiApi
        ? {
            query: prompt,
            // freshness: 'oneWeek',
            summary: true,
            count: 20,
          }
        : isTavilyApi
        ? {
            query: prompt,
            search_depth: 'basic',
            // search_depth: 'advanced',
            include_answer: false,
            // include_raw_content: true,
            include_images: true,
            max_results: 10,
          }
        : {
            tool: 'web-search-pro',
            stream: false,
            messages: [{ role: 'user', content: prompt }],
          };

      Logger.log(`[搜索] 请求参数: ${JSON.stringify(requestBody, null, 2)}`);

      const response = await fetch(pluginUrl, {
        method: 'POST',
        headers: {
          Authorization: selectedKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        Logger.error(`[搜索] 接口返回错误: ${response.status}`);
        return { searchResults: [], images: [] };
      }

      const apiResult = await response.json();
      Logger.log(`[搜索] 原始返回数据: ${JSON.stringify(apiResult, null, 2)}`);

      let searchResults: any[] = [];

      if (isBochaiApi) {
        if (apiResult?.code === 200 && apiResult?.data?.webPages?.value) {
          searchResults = apiResult.data.webPages.value.map((item: any) => ({
            title: item?.name || '',
            link: item?.url || '',
            content: item?.summary || '',
            icon: item?.siteIcon || '',
            media: item?.siteName || '',
          }));
        }
      } else if (isBigModelApi) {
        if (apiResult?.choices?.[0]?.message?.tool_calls?.length > 0) {
          for (const toolCall of apiResult.choices[0].message.tool_calls) {
            if (Array.isArray(toolCall.search_result)) {
              searchResults = toolCall.search_result.map((item: any) => ({
                title: item?.title || '',
                link: item?.link || '',
                content: item?.content || '',
                icon: item?.icon || '',
                media: item?.media || '',
              }));
              break;
            }
          }
        }
      } else if (isTavilyApi) {
        if (Array.isArray(apiResult?.results)) {
          searchResults = apiResult.results.map((item: any) => ({
            title: item?.title || '',
            link: item?.url || '',
            content: item?.raw_content || item?.content || '',
            icon: '',
            media: '',
          }));
        }
      }

      const formattedResult = searchResults.map((item, index) => ({
        resultIndex: index + 1,
        ...item,
      }));

      // 提取 Tavily API 返回的图片
      let images: string[] = [];
      if (isTavilyApi && Array.isArray(apiResult?.images)) {
        images = apiResult.images;
      }

      // 处理博查API返回的图片
      if (isBochaiApi) {
        // 博查API的图片可能在两个不同的路径
        if (apiResult?.data?.images?.value && Array.isArray(apiResult.data.images.value)) {
          // 从博查API的图片结构中提取contentUrl
          images = apiResult.data.images.value
            .filter(img => img.contentUrl)
            .map(img => img.contentUrl);
        }
        // else if (
        //   apiResult?.images?.value &&
        //   Array.isArray(apiResult.images.value)
        // ) {
        //   // 备选路径
        //   images = apiResult.images.value
        //     .filter((img) => img.contentUrl)
        //     .map((img) => img.contentUrl);
        // }
      }

      Logger.log(`[搜索] 格式化后的结果: ${JSON.stringify(formattedResult, null, 2)}`);

      // 同时返回搜索结果和图片数组
      return {
        searchResults: formattedResult,
        images: images,
      };
    } catch (fetchError) {
      Logger.error('[搜索] 调用接口出错:', fetchError);
      return {
        searchResults: [],
        images: [],
      };
    }
  }
}
