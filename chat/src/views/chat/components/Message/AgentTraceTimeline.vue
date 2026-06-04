<script setup lang="ts">
import { fetchRetryTraceItemAPI } from '@/api/chatLog'
import { copyText } from '@/utils/format'
import { message } from '@/utils/message'
import { computed, inject, ref } from 'vue'

type AgentTraceItemType =
  | 'search'
  | 'file_read'
  | 'image_generation'
  | 'error'
  | 'artifact'
  | 'citation'
  | 'tool'
  | 'text'

interface AgentTraceItem {
  id: string
  type: AgentTraceItemType
  title?: string
  summary?: string
  status?: 'pending' | 'running' | 'success' | 'failed'
  createdAt?: string
  updatedAt?: string
  data?: Record<string, any>
  error?: string
}

const props = defineProps<{
  runId?: number
  items?: AgentTraceItem[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (ev: 'rerun', payload: { runId: number; failedItemId: string }): void
  (ev: 'continue-edit', item: AgentTraceItem): void
}>()

const ms = message()
const expanded = ref<Record<string, boolean>>({})
const retrying = ref<Record<string, boolean>>({})
const onOpenImagePreviewer =
  inject<(imageUrls: string[], initialIndex: number, extraData?: any) => void>(
    'onOpenImagePreviewer'
  )

const visibleItems = computed(() => props.items || [])

function titleFor(item: AgentTraceItem) {
  const fallback: Record<AgentTraceItemType, string> = {
    search: '搜索结果',
    file_read: '文件读取',
    image_generation: '图片生成',
    error: '错误',
    artifact: 'Artifact',
    citation: 'Citation',
    tool: '工具调用',
    text: '执行步骤',
  }
  return item.title || fallback[item.type] || '执行步骤'
}

function statusText(item: AgentTraceItem) {
  if (item.status === 'failed') return '失败'
  if (item.status === 'running') return '执行中'
  if (item.status === 'pending') return '待重试'
  return '完成'
}

function statusClass(item: AgentTraceItem) {
  if (item.status === 'failed') return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300'
  if (item.status === 'running' || item.status === 'pending')
    return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300'
  return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300'
}

function dataList(item: AgentTraceItem, key: string) {
  const value = item.data?.[key]
  if (Array.isArray(value)) return value
  if (typeof item.data?.raw === 'string') {
    try {
      const parsed = JSON.parse(item.data.raw)
      return Array.isArray(parsed) ? parsed : parsed?.[key] || []
    } catch (error) {
      return []
    }
  }
  return []
}

function artifactUrl(item: AgentTraceItem) {
  return item.data?.url || item.data?.href || item.data?.downloadUrl || item.summary || ''
}

function imageUrls(item: AgentTraceItem) {
  return dataList(item, 'urls').length
    ? dataList(item, 'urls')
    : artifactUrl(item)
      ? [artifactUrl(item)]
      : []
}

function preview(item: AgentTraceItem) {
  const urls = imageUrls(item)
  if (item.type === 'image_generation' && urls.length && onOpenImagePreviewer) {
    onOpenImagePreviewer(urls, 0, item.data)
    return
  }
  const url = artifactUrl(item)
  if (url) window.open(url, '_blank')
}

function download(item: AgentTraceItem) {
  const url = artifactUrl(item)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = item.data?.name || titleFor(item)
  a.target = '_blank'
  a.click()
}

function copyReference(item: AgentTraceItem) {
  const ref =
    item.data?.reference ||
    item.data?.citation ||
    artifactUrl(item) ||
    item.summary ||
    titleFor(item)
  copyText({ text: String(ref) })
  ms.success('引用已复制')
}

async function retry(item: AgentTraceItem) {
  if (!props.runId) return
  retrying.value[item.id] = true
  try {
    await fetchRetryTraceItemAPI({ runId: props.runId, failedItemId: item.id })
    ms.success('已提交重试请求')
    emit('rerun', { runId: props.runId, failedItemId: item.id })
  } catch (error) {
    ms.error('提交重试失败')
  } finally {
    retrying.value[item.id] = false
  }
}
</script>

<template>
  <div
    v-if="visibleItems.length"
    class="mb-3 rounded-2xl border border-gray-200 bg-white/60 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/40"
  >
    <div class="mb-2 flex items-center justify-between text-gray-700 dark:text-gray-200">
      <span class="font-medium">执行过程</span>
      <span class="text-xs text-gray-400">{{ visibleItems.length }} 项</span>
    </div>

    <div class="space-y-2">
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30"
      >
        <div class="flex items-start justify-between gap-3">
          <button
            class="flex min-w-0 flex-1 items-start gap-2 text-left"
            @click="expanded[item.id] = !expanded[item.id]"
          >
            <span
              class="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
              :class="
                item.status === 'failed'
                  ? 'bg-red-500'
                  : item.status === 'running'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              "
            ></span>
            <span class="min-w-0">
              <span class="block truncate font-medium text-gray-800 dark:text-gray-100">{{
                titleFor(item)
              }}</span>
              <span
                v-if="item.summary || item.error"
                class="mt-0.5 block line-clamp-2 text-xs text-gray-500 dark:text-gray-400"
                >{{ item.error || item.summary }}</span
              >
            </span>
          </button>
          <span class="rounded-full px-2 py-0.5 text-xs" :class="statusClass(item)">{{
            statusText(item)
          }}</span>
        </div>

        <div
          v-if="expanded[item.id]"
          class="mt-3 space-y-2 border-l border-gray-200 pl-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <div v-if="item.type === 'search'" class="space-y-1">
            <a
              v-for="(result, idx) in dataList(item, 'results').slice(0, 8)"
              :key="idx"
              :href="result.link || result.url"
              target="_blank"
              class="block truncate hover:underline"
            >
              {{ idx + 1 }}. {{ result.title || result.link || result.url }}
            </a>
          </div>

          <div v-else-if="item.type === 'file_read'" class="space-y-1">
            <div
              v-for="(result, idx) in dataList(item, 'results').slice(0, 5)"
              :key="idx"
              class="rounded bg-white/60 p-2 dark:bg-gray-800/60"
            >
              <div class="font-medium">
                {{ result.fileName || result.name || `片段 ${idx + 1}` }}
              </div>
              <div class="line-clamp-3">{{ result.content || result.text || result.summary }}</div>
            </div>
          </div>

          <div
            v-else-if="item.type === 'image_generation'"
            class="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <img
              v-for="(url, idx) in imageUrls(item)"
              :key="idx"
              :src="url"
              class="h-20 w-full cursor-pointer rounded-lg object-cover"
              @click="preview(item)"
            />
          </div>

          <div
            v-else-if="item.type === 'error'"
            class="rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-200"
          >
            {{ item.error || item.summary || '执行失败' }}
          </div>

          <pre
            v-else
            class="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 dark:bg-gray-800/70"
            >{{ item.data || item.summary }}</pre
          >

          <div class="flex flex-wrap gap-2 pt-1">
            <button
              v-if="item.status === 'failed' || item.type === 'error'"
              class="btn-pill px-3 py-1"
              :disabled="retrying[item.id]"
              @click="retry(item)"
            >
              {{ retrying[item.id] ? '提交中…' : '重试此步骤/重新运行' }}
            </button>
            <button
              v-if="
                item.type === 'artifact' ||
                item.type === 'citation' ||
                item.type === 'image_generation'
              "
              class="btn-pill px-3 py-1"
              @click="preview(item)"
            >
              预览
            </button>
            <button
              v-if="
                item.type === 'artifact' ||
                item.type === 'citation' ||
                item.type === 'image_generation'
              "
              class="btn-pill px-3 py-1"
              @click="download(item)"
            >
              下载
            </button>
            <button
              v-if="item.type === 'artifact' || item.type === 'citation'"
              class="btn-pill px-3 py-1"
              @click="copyReference(item)"
            >
              复制引用
            </button>
            <button
              v-if="item.type === 'artifact'"
              class="btn-pill px-3 py-1"
              @click="emit('continue-edit', item)"
            >
              继续编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
