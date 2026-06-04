<script setup lang="ts">
import { Close } from '@icon-park/vue-next'
import { ref, watch } from 'vue'

interface FileItem {
  name: string
  url: string
  type?: string
  fileId?: string
  mime?: string
  size?: number
  status?: string
}

interface Props {
  dataBase64List: string[]
  fileList: File[]
  savedFiles: FileItem[]
  isSelectedAgent: boolean
  selectedAgent?: any
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'clearData', index: number, isSavedFile: boolean): void
  (e: 'clearSelectAgent'): void
}>()

const convertingFileIndex = ref<number | null>(null)
const processedFileCount = ref(0)

const handleClearData = (index: number, isSavedFile: boolean) => {
  emit('clearData', index, isSavedFile)
}

const handleClearSelectAgent = () => {
  emit('clearSelectAgent')
}

const formatFileSize = (size?: number) => {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    uploaded: '等待解析',
    parsing: '解析中',
    parsed: '已解析',
    failed: '解析失败',
  }
  return map[status || ''] || '已上传'
}

watch(
  () => props.savedFiles,
  newFiles => {
    processedFileCount.value = newFiles.length
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div
    v-if="dataBase64List.length > 0 || savedFiles.length > 0 || isSelectedAgent"
    class="self-start w-full select-none"
  >
    <div class="self-start w-full rounded-t-2xl mt-2">
      <div v-if="isSelectedAgent && selectedAgent" class="relative w-full mb-2">
        <div
          class="flex px-2 bg-opacity dark:bg-gray-750 rounded-b-md rounded-t-2xl items-center justify-start h-12 text-gray-700 dark:text-gray-400 shadow-sm"
        >
          <div
            class="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden shadow-sm border border-gray-300 mr-3"
          >
            <img
              v-if="selectedAgent.coverImg"
              :src="selectedAgent.coverImg"
              alt="Agent icon"
              class="w-8 h-8 rounded-full flex justify-start"
            />
            <span
              v-else
              class="w-8 h-8 text-base font-medium text-gray-700 dark:text-gray-400 rounded-full flex items-center justify-center dark:bg-gray-700"
            >
              {{ selectedAgent.name?.charAt(0) }}
            </span>
          </div>

          <h3
            class="text-md font-bold text-gray-600 dark:text-gray-400 mr-3 flex-shrink-0 flex justify-start"
          >
            {{ selectedAgent.name }}
          </h3>
          <p class="text-base text-gray-400 dark:text-gray-400 truncate pr-10">
            {{ selectedAgent.des }}
          </p>

          <div
            class="absolute top-1/2 right-4 transform -translate-y-1/2 cursor-pointer text-gray-300 hover:text-gray-500"
            @click="handleClearSelectAgent()"
          >
            <Close size="18" class="rounded-full" />
          </div>
        </div>
      </div>

      <div class="flex flex-wrap px-2">
        <template v-if="savedFiles.length > 0">
          <div
            v-for="file in savedFiles.filter((f: FileItem) => f.type === 'image')"
            :key="`saved-img-${savedFiles.indexOf(file)}`"
            class="relative inline-block mr-2 mb-2"
          >
            <img
              :src="file.url"
              class="max-h-16 border border-gray-100 shadow-sm dark:border-gray-700 rounded-md"
              alt="预览图片"
            />
            <div
              class="absolute top-1 right-1 cursor-pointer bg-white dark:bg-gray-700 rounded-full p-1 shadow-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              @click="handleClearData(savedFiles.indexOf(file), true)"
            >
              <Close class="w-3 h-3" />
            </div>
          </div>

          <div
            v-for="file in savedFiles.filter((f: FileItem) => f.type === 'document')"
            :key="`saved-file-${savedFiles.indexOf(file)}`"
            class="relative inline-block mr-2 mb-2"
          >
            <div
              class="px-3 flex items-center justify-start rounded-xl h-10 text-gray-700 dark:text-gray-400 border border-gray-100 shadow-sm dark:border-gray-700 transition-colors relative"
            >
              <div
                v-if="convertingFileIndex === savedFiles.indexOf(file)"
                class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 rounded-xl z-10"
              >
                <div class="loading-animation">
                  <span></span>
                </div>
              </div>

              <div class="flex flex-col min-w-0 mr-4">
                <a
                  :href="file.url"
                  target="_blank"
                  class="text-gray-500 max-w-48 truncate hover:underline"
                  :title="file.fileId ? `fileId: ${file.fileId}` : file.name"
                >
                  {{ file.name }}
                </a>
                <span class="text-[10px] text-gray-400 truncate">
                  {{ statusText(file.status) }}
                  <template v-if="file.fileId"> · {{ file.fileId }}</template>
                  <template v-if="formatFileSize(file.size)">
                    · {{ formatFileSize(file.size) }}
                  </template>
                </span>
              </div>
            </div>
            <div
              v-if="convertingFileIndex !== savedFiles.indexOf(file)"
              class="absolute top-1 right-1 cursor-pointer bg-opacity dark:bg-gray-750 rounded-full p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              @click="handleClearData(savedFiles.indexOf(file), true)"
            >
              <Close class="w-3 h-3" />
            </div>
          </div>
        </template>

        <template
          v-if="dataBase64List.length > 0"
          v-for="(base64, index) in dataBase64List"
          :key="`item-${index}`"
        >
          <div
            v-if="fileList[index]?.type.startsWith('image/')"
            class="relative inline-block mr-2 mb-2"
          >
            <img
              :src="base64"
              class="max-h-16 border border-gray-100 shadow-sm dark:border-gray-700 rounded-xl"
              alt="预览图片"
            />
            <div
              class="absolute top-1 right-1 cursor-pointer bg-white dark:bg-gray-700 rounded-full p-1 shadow-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              @click="handleClearData(index, false)"
            >
              <Close class="w-3 h-3" />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
