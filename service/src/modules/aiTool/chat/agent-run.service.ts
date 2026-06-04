import { Injectable } from '@nestjs/common';

export interface SearchDecision {
  shouldSearch: boolean;
  forced: boolean;
  disabledByUser: boolean;
  reason: string;
}

@Injectable()
export class AgentRunService {
  private readonly forceSearchPattern =
    /(新闻|最新|最近|今天|今日|现在|当前|刚刚|实时|价格|股价|汇率|政策|法规|条例|比赛|赛程|比分|版本|发布|更新|latest|recent|today|current|now|news|price|policy|regulation|score|game|match|version|release|update)/i;

  decideSearch(prompt: string, usingNetwork?: boolean): SearchDecision {
    const forced = this.forceSearchPattern.test(prompt || '');
    const disabledByUser = usingNetwork === false;

    if (disabledByUser) {
      return {
        shouldSearch: false,
        forced,
        disabledByUser,
        reason: forced
          ? '用户已关闭搜索；该问题需要最新信息，回答将受到限制。'
          : '用户已关闭搜索。',
      };
    }

    if (usingNetwork || forced) {
      return {
        shouldSearch: true,
        forced,
        disabledByUser: false,
        reason: forced ? '问题涉及时效性信息，强制启用搜索。' : '用户启用搜索。',
      };
    }

    return {
      shouldSearch: false,
      forced: false,
      disabledByUser: false,
      reason: '问题未命中自动搜索规则。',
    };
  }

  appendCitationGuard(answer: string, citations: Array<{ citationId?: string; url?: string }>) {
    if (!citations.length || this.hasCitation(answer, citations)) {
      return answer;
    }

    const citation = citations[0];
    const citationText =
      citation.citationId && citation.url ? `[[${citation.citationId}](${citation.url})]` : '';
    return `${answer}${answer.endsWith('\n') ? '' : '\n\n'}来源：${citationText}`;
  }

  hasCitation(answer: string, citations: Array<{ citationId?: string; url?: string }>) {
    if (!answer) {
      return false;
    }

    return citations.some(citation => {
      if (!citation.url && !citation.citationId) {
        return false;
      }
      return Boolean(
        (citation.url && answer.includes(citation.url)) ||
          (citation.citationId && new RegExp(`\\[\\[?${citation.citationId}\\]?`).test(answer)),
      );
    });
  }
}
