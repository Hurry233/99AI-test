<script lang="ts" setup>
import { fetchQueryOneAgentAPI } from '@/api/agent'
import logo from '@/assets/logo.png'
import { useAuthStore, useChatStore } from '@/store'
import { computed, ref, watch } from 'vue'

const appDetail: any = ref({ name: '', des: '', coverImg: '' })
const authStore = useAuthStore()
const logoPath = computed(() => authStore.globalConfig.clientLogoPath || logo)
// 获取用户昵称
const nickname = computed(() => (authStore.userInfo as any)?.nickname || '')
// 根据时间获取问候语
const greeting = computed(() => {
  const hour = new Date().getHours()
  let greet = ''

  if (hour < 6) greet = '凌晨好'
  else if (hour < 9) greet = '早上好'
  else if (hour < 12) greet = '上午好'
  else if (hour < 14) greet = '中午好'
  else if (hour < 18) greet = '下午好'
  else greet = '晚上好'

  if (nickname.value) {
    return `${greet}，${nickname.value}，欢迎使用${authStore.globalConfig?.siteName}`
  } else {
    return `${greet}，欢迎使用${authStore.globalConfig?.siteName}`
  }
})

const homeWelcomeContent =
  authStore.globalConfig?.homeWelcomeContent ||
  '像 ChatGPT 一样，把研究、写作、代码、数据和多模态任务交给 Agent 持续推进。'

const agentCapabilities = [
  {
    title: '深度研究',
    desc: '梳理资料、生成报告、对比方案',
    accent: 'from-blue-500 to-cyan-500',
  },
  {
    title: '写作与创作',
    desc: '起草、改写、翻译、生成结构化内容',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    title: '代码与自动化',
    desc: '编程、调试、解释代码与构建工作流',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    title: '文件与数据分析',
    desc: '读取文件、提炼要点、辅助表格分析',
    accent: 'from-amber-500 to-orange-500',
  },
]

const chatStore = useChatStore()
const activeGroupInfo = computed(() => chatStore.getChatByGroupInfo())
const activeAppId = computed(() => activeGroupInfo?.value?.appId || 0)

const queryAppInfo = async (appId: number) => {
  try {
    const res: any = await fetchQueryOneAgentAPI({ id: appId })
    if (res.data) {
      appDetail.value = res.data
    } else {
      appDetail.value = { name: '', des: '', coverImg: '' }
    }
  } catch (error) {}
}

function bgRandomColor() {
  const hues = [
    'bg-blue-300',
    'bg-red-300',
    'bg-green-300',
    'bg-yellow-300',
    'bg-purple-300',
    'bg-pink-300',
  ]
  return hues[Math.floor(Math.random() * hues.length)]
}

watch(
  () => activeAppId.value,
  newVal => {
    if (newVal) {
      queryAppInfo(newVal)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="activeAppId" class="flex flex-col justify-center items-center select-none">
    <div class="flex items-center mb-2">
      <img v-if="appDetail?.coverImg" :src="appDetail?.coverImg" alt="Logo" class="h-7 w-7 mr-2" />
      <div
        v-else
        :class="[
          'flex-shrink-0 dark:ring-gray-400 rounded-full w-7 h-7 flex items-center justify-center mr-2',
          bgRandomColor(),
        ]"
      >
        <span class="text-white text-sm md:text-lg">{{ appDetail.name.slice(0, 1) }}</span>
      </div>
      <h1 class="text-3xl font-bold text-primary-500">{{ appDetail?.name }}</h1>
    </div>
    <h2 class="mb-2 rounded px-4 py-2 text-center text-base text-gray-600">
      {{ appDetail?.des }}
    </h2>
  </div>

  <!-- 当 appDetail 不存在时显示的内容 -->
  <div v-else class="flex w-full max-w-4xl flex-col items-center justify-center select-none px-4">
    <div class="flex items-center text-center">
      <img :src="logoPath" alt="Logo" class="h-8 w-8 mr-3 rounded-xl" />
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 md:text-3xl">
        {{ greeting }}
      </h1>
    </div>
    <h2
      class="mt-3 max-w-2xl rounded text-center text-base leading-7 text-gray-600 dark:text-gray-400"
    >
      {{ homeWelcomeContent }}
    </h2>

    <div class="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="capability in agentCapabilities"
        :key="capability.title"
        class="rounded-2xl border border-gray-100 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/80"
      >
        <div :class="['mb-3 h-1.5 w-12 rounded-full bg-gradient-to-r', capability.accent]"></div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ capability.title }}
        </h3>
        <p class="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{{ capability.desc }}</p>
      </div>
    </div>
  </div>
</template>
