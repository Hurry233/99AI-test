export type AgentTraceStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AttachmentRef {
  id: string
  type: 'image' | 'file' | 'audio' | 'video' | 'link'
  name?: string
  url: string
  mimeType?: string
  source?: 'upload' | 'generated' | 'tool' | 'legacy'
  metadata?: Record<string, unknown>
}

export interface Artifact {
  id: string
  type: 'image' | 'file' | 'audio' | 'video' | 'text' | 'html' | 'markdown' | 'json'
  title?: string
  content?: string
  url?: string
  attachments?: AttachmentRef[]
  metadata?: Record<string, unknown>
  createdAt?: string
}

export type ResponseItem =
  | {
      id: string
      type: 'message' | 'message_delta'
      role: 'assistant' | 'user' | 'system'
      text: string
      attachments?: AttachmentRef[]
      metadata?: Record<string, unknown>
    }
  | {
      id: string
      type: 'reasoning' | 'reasoning_delta'
      text: string
      metadata?: Record<string, unknown>
    }
  | {
      id: string
      type: 'tool_call'
      name: string
      status?: AgentTraceStatus
      arguments?: unknown
      metadata?: Record<string, unknown>
    }
  | {
      id: string
      type: 'tool_result'
      name: string
      status?: AgentTraceStatus
      output?: unknown
      attachments?: AttachmentRef[]
      metadata?: Record<string, unknown>
    }
  | { id: string; type: 'artifact'; artifact: Artifact; metadata?: Record<string, unknown> }

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function parseMaybeJson<T = any>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function serializeResponseItems(items?: ResponseItem[] | string): string {
  if (!items) return ''
  return typeof items === 'string' ? items : JSON.stringify(items)
}

export function normalizeResponseItems(value?: ResponseItem[] | string): ResponseItem[] {
  const parsed = parseMaybeJson<ResponseItem[] | any>(value, [])
  return Array.isArray(parsed) ? parsed : []
}

export function normalizeArtifacts(value?: Artifact[] | string): Artifact[] {
  const parsed = parseMaybeJson<Artifact[] | any>(value, [])
  return Array.isArray(parsed) ? parsed : []
}

function normalizeUrlAttachments(value: unknown, type: AttachmentRef['type']): AttachmentRef[] {
  const parsed = parseMaybeJson<any>(value, value as any)
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed?.imageUrls
      ? parsed.imageUrls
      : typeof parsed === 'string'
        ? parsed
            .split(',')
            .map((url: string) => url.trim())
            .filter(Boolean)
        : []

  return values
    .map((entry: any, index: number) => {
      const url = typeof entry === 'string' ? entry : entry?.url
      if (!url) return null
      return {
        id: entry?.id || uid(`${type}-${index}`),
        type,
        name: entry?.name,
        url,
        mimeType: entry?.type || entry?.mimeType,
        source: 'legacy',
      } as AttachmentRef
    })
    .filter(Boolean) as AttachmentRef[]
}

export function attachmentsFromLegacy(chat: Partial<Chat.Chat>): AttachmentRef[] {
  return [
    ...normalizeUrlAttachments(chat.imageUrl, 'image'),
    ...normalizeUrlAttachments(chat.fileUrl, 'file'),
    ...normalizeUrlAttachments(chat.audioUrl, 'audio'),
    ...normalizeUrlAttachments(chat.videoUrl, 'video'),
  ]
}

export function responseItemsFromLegacy(chat: Partial<Chat.Chat>): ResponseItem[] {
  const existing = normalizeResponseItems(chat.responseItems as any)
  if (existing.length) return existing

  const items: ResponseItem[] = []
  const attachments = attachmentsFromLegacy(chat)
  if (chat.content) {
    items.push({
      id: uid('message'),
      type: 'message',
      role: (chat.role as any) || 'assistant',
      text: chat.content,
      attachments: attachments.length ? attachments : undefined,
    })
  }
  if (chat.reasoningText || chat.reasoning_content) {
    items.push({
      id: uid('reasoning'),
      type: 'reasoning',
      text: chat.reasoningText || chat.reasoning_content || '',
    })
  }
  if (chat.networkSearchResult) {
    items.push({
      id: uid('network-search'),
      type: 'tool_result',
      name: 'network_search',
      status: 'completed',
      output: parseMaybeJson(chat.networkSearchResult, chat.networkSearchResult),
    })
  }
  if (chat.fileVectorResult) {
    items.push({
      id: uid('file-vector'),
      type: 'tool_result',
      name: 'file_vector_search',
      status: 'completed',
      output: parseMaybeJson(chat.fileVectorResult, chat.fileVectorResult),
    })
  }
  if (chat.tool_calls) {
    const calls = parseMaybeJson<any[]>(chat.tool_calls, [])
    ;(Array.isArray(calls) ? calls : [chat.tool_calls])
      .filter(Boolean)
      .forEach((call: any, index: number) => {
        items.push({
          id: call?.id || uid(`tool-call-${index}`),
          type: 'tool_call',
          name: call?.function?.name || call?.name || 'tool_call',
          status: 'completed',
          arguments: call?.function?.arguments || call?.arguments || call,
        })
      })
  }
  attachments.forEach((attachment, index) => {
    items.push({
      id: uid(`artifact-${index}`),
      type: 'artifact',
      artifact: {
        id: attachment.id,
        type: attachment.type === 'link' ? 'file' : attachment.type,
        title: attachment.name,
        url: attachment.url,
        attachments: [attachment],
      },
    })
  })
  return items
}

export function artifactsFromResponseItems(
  items: ResponseItem[],
  legacyChat?: Partial<Chat.Chat>
): Artifact[] {
  const artifacts = normalizeArtifacts(legacyChat?.artifacts as any)
  items.forEach(item => {
    if (item.type === 'artifact') artifacts.push(item.artifact)
    if ('attachments' in item && item.attachments?.length) {
      item.attachments.forEach(attachment => {
        artifacts.push({
          id: attachment.id,
          type: attachment.type === 'link' ? 'file' : attachment.type,
          title: attachment.name,
          url: attachment.url,
          attachments: [attachment],
        })
      })
    }
  })
  return artifacts
}

export function summarizeTools(items: ResponseItem[]): string {
  const names = items
    .filter(item => item.type === 'tool_call' || item.type === 'tool_result')
    .map((item: any) => item.name)
    .filter(Boolean)
  return Array.from(new Set(names)).join('、')
}
