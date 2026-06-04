<script setup lang="ts">
import {
  fetchCollectAgentAPI,
  fetchQueryAgentCategoriesAPI,
  fetchQueryAgentsAPI,
  type AgentCategory,
  type AgentItem,
} from '@/api/agent'
// import { fetchQueryMenuAPI } from '@/api/config';
import type { ResData } from '@/api/types'
// 移除DynamicFormModal组件的导入
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'
import { useAppCatStore, useAuthStoreWithout, useGlobalStoreWithOut } from '@/store'
import { DIALOG_TABS } from '@/store/modules/global'
import { message } from '@/utils/message'
import { Left, Right, Search, Star, VipOne } from '@icon-park/vue-next'
import PinyinMatch from 'pinyin-match'
import { computed, inject, onMounted, ref, watch } from 'vue'

interface FormField {
  type: 'input' | 'select'
  title: string
  placeholder: string
  options?: string[]
}

const authStore = useAuthStoreWithout()
const userBalance = computed(() => authStore.userBalance)

const { isMobile } = useBasicLayout()
const useGlobalStore = useGlobalStoreWithOut()

const ms = message()
const appCatStore = useAppCatStore()
const keyword = ref('')
const catId = computed(() => appCatStore.catId)
const agentList = ref<AgentItem[]>([])
const activeList = ref<AgentItem[]>([])
const mineApps = computed(() => appCatStore.mineApps)
const catList = ref<AgentCategory[]>([])
const activeCatId = ref(0)

// 从chatBase inject弹窗相关方法
const showAppConfigModal = inject('showAppConfigModal') as
  | ((app: any, formSchema: FormField[]) => void)
  | undefined
const tryParseJson = inject('tryParseJson') as
  | ((jsonString: string | undefined | null) => FormField[] | null)
  | undefined

// Define emits
const emit = defineEmits(['run-app', 'show-member-dialog', 'run-app-with-data'])

function isMineAgent(agent: AgentItem): boolean {
  return mineApps.value.some((item: any) => item.appId === agent.id)
}

async function queryAgents() {
  const res: ResData = await fetchQueryAgentsAPI()
  agentList.value = res?.data?.rows.map((item: AgentItem) => {
    item.loading = false
    return item
  })
  activeList.value = agentList.value
}

const list = computed(() => {
  if (keyword.value) {
    const keywordLower = keyword.value.toLowerCase()
    return agentList.value.filter(item => PinyinMatch.match(item.name, keywordLower))
  }
  if (activeCatId.value === 0) return agentList.value

  return agentList.value.filter(item => {
    if (!item.catId) return false
    const catIds = String(item.catId)
      .split(',')
      .map(id => Number(id.trim()))
    return catIds.includes(activeCatId.value)
  })
})

async function handleCollect(agent: AgentItem) {
  agent.loading = true
  try {
    const res: ResData = await fetchCollectAgentAPI({ appId: agent.id })
    ms.success(res.data)
    await appCatStore.queryMineApps()
    agent.loading = false
  } catch (error) {
    agent.loading = false
  }
}

async function handleRunAgent(agent: AgentItem) {
  const appCats = agent.catName?.split(',').map(cat => cat.trim()) || []
  const isMemberApp = appCats.some(catName => isMemberCategory(catName))

  if (isMemberApp) {
    const isMember =
      (userBalance.value as any).packageId > 0 ||
      (userBalance.value.expirationTime && new Date(userBalance.value.expirationTime) > new Date())

    if (!isMember) {
      ms.info('当前 Agent 是会员专属能力，请开通会员后使用！')
      if (isMobile.value) {
        useGlobalStore.settingsActiveTab = DIALOG_TABS.MEMBER
        useGlobalStore.updateMobileSettingsDialog(true)
      } else {
        useGlobalStore.updateSettingsDialog(true, DIALOG_TABS.MEMBER)
      }
      return
    }
  }


  if (tryParseJson && showAppConfigModal) {
    const formSchema = tryParseJson(agent.prompt)

    if (formSchema) {
      showAppConfigModal(agent, formSchema)

      return
    }
  }


  // 如果没有配置或没有 inject 到方法，直接运行 Agent
  emit('run-app', agent)

}

async function queryCats() {
  const res: ResData = await fetchQueryAgentCategoriesAPI()
  const defaultCat = {
    id: 0,
    name: t('app.allCategories'),
    coverImg: '',
    des: '',
  }
  catList.value = [defaultCat, ...res?.data?.rows]
}

function handleChangeCatId(id: number) {
  activeCatId.value = id
}

watch(catId, val => {
  if (!val) activeList.value = agentList.value
  else {
    activeList.value = agentList.value.filter(item => {
      if (!item.catId) return false
      const catIds = String(item.catId)
        .split(',')
        .map(id => Number(id.trim()))
      return catIds.includes(Number(val))
    })
  }
})

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

const scrollContainer = ref<HTMLElement | null>(null)

function scrollLeft() {
  if (scrollContainer.value) {
    scrollContainer.value.scrollBy({ left: -100, behavior: 'smooth' })
  }
}

function scrollRight() {
  if (scrollContainer.value) {
    scrollContainer.value.scrollBy({ left: 100, behavior: 'smooth' })
  }
}

function handleClickCategoryTag(catName: string) {
  const category = catList.value.find(cat => cat.name === catName)
  if (category) {
    handleChangeCatId(category.id)
    if (isMobile.value && scrollContainer.value) {
      scrollContainer.value.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

function isMemberCategory(catName: string): boolean {
  const category = catList.value.find(cat => cat.name === catName)
  return category ? category.isMember === 1 : false
}

onMounted(() => {
  queryCats()
  queryAgents()
})
</script>

<template>
  <!-- Agent 工作台 -->
  <div
    class="bg-white dark:bg-gray-900 flex flex-col h-full w-full"
    :class="[isMobile ? 'px-2 py-2' : 'pb-3']"
  >
    <section class="mx-auto w-full flex-shrink-0 px-1 pt-2" :class="[isMobile ? '' : 'px-20']">
      <div
        class="rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-5 shadow-sm dark:border-gray-800 dark:from-gray-850 dark:to-gray-900"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
          Agent Platform
        </p>
        <div class="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Agent 工作台
            </h1>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              以 ChatGPT 官网体验为方向，保留真正有价值的 Agent
              能力：研究、写作、代码、文件分析与多步骤任务编排。
            </p>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
            <div class="rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-gray-800">
              <strong class="block text-sm text-gray-900 dark:text-gray-100">任务</strong>
              可编排
            </div>
            <div class="rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-gray-800">
              <strong class="block text-sm text-gray-900 dark:text-gray-100">模型</strong>
              可切换
            </div>
            <div class="rounded-2xl bg-white px-3 py-2 shadow-sm dark:bg-gray-800">
              <strong class="block text-sm text-gray-900 dark:text-gray-100">文件</strong>
              可分析
            </div>
          </div>
        </div>
      </div>
    </section>

    <div
      class="flex justify-between items-center my-3 flex-shrink-0 mx-auto w-full"
      :class="[isMobile ? 'w-full' : 'px-20']"
    >
      <Left
        v-if="!isMobile"
        size="20"
        class="btn-icon btn-md flex-shrink-0 mr-1"
        @click="scrollLeft"
      />

      <div v-if="!isMobile" class="relative flex-grow mx-1 overflow-hidden" style="max-width: 65%">
        <div
          ref="scrollContainer"
          class="flex items-center overflow-x-auto w-full scrollbar-hide"
          style="margin: auto; scrollbar-width: none; -ms-overflow-style: none"
        >
          <div
            v-for="(item, index) in catList"
            :key="index"
            @click="handleChangeCatId(item.id)"
            class="btn-pill btn-md flex-none mx-1"
            :class="{ 'btn-pill-active': activeCatId === item.id }"
          >
            <span>{{ item.name }}</span>
            <span v-if="item.isMember === 1" class="ml-1 text-yellow-500 inline-flex items-center">
              <VipOne size="14" />
            </span>
          </div>
        </div>
      </div>
      <Right
        v-if="!isMobile"
        size="20"
        class="btn-icon btn-md flex-shrink-0 mx-1"
        @click="scrollRight"
      />
      <div class="ml-1 flex relative" :class="[isMobile ? 'w-full mr-2' : 'w-[35%]']">
        <div class="relative flex flex-1 w-full items-center">
          <label for="app-search-field" class="sr-only">
            {{ t('app.searchAppNameQuickFind') }}
          </label>
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search theme="outline" size="18" class="text-gray-400" />
          </div>
          <input
            id="app-search-field"
            v-model="keyword"
            class="input input-md w-full pl-10"
            :placeholder="t('app.searchAppNameQuickFind')"
            type="search"
            name="app-search"
          />
        </div>
      </div>
    </div>

    <div
      v-if="isMobile"
      class="flex justify-between items-center flex-shrink-0"
      style="max-width: 100%"
    >
      <div
        ref="scrollContainer"
        class="flex items-center overflow-x-auto scrollbar-hide"
        style="scrollbar-width: none; -ms-overflow-style: none"
      >
        <div
          v-for="(item, index) in catList"
          :key="index"
          @click="handleChangeCatId(item.id)"
          class="btn-pill flex-none mx-1"
          :class="{ 'btn-pill-active': activeCatId === item.id }"
        >
          <span>{{ item.name }}</span>
          <span v-if="item.isMember === 1" class="ml-1 text-yellow-500 inline-flex items-center">
            <VipOne size="14" />
          </span>
        </div>
      </div>
    </div>

    <div class="w-full flex-grow items-start overflow-hidden">
      <transition-group
        name="list"
        tag="div"
        class="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar grid p-1 mt-4 pb-5"
        :class="[
          isMobile
            ? 'grid-cols-1 gap-2'
            : ' grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 mx-auto px-20',
        ]"
        style="align-content: start"
      >
        <div
          v-for="item in list"
          :key="item.id"
          @click="handleRunAgent(item)"
          class="group cursor-pointer flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 bg-gray-50 dark:bg-gray-750 ring-1 ring-gray-100 dark:ring-gray-750 hover:shadow-md"
          style="min-height: 7rem"
        >
          <div v-if="item.coverImg" class="flex-shrink-0">
            <img :src="item.coverImg" class="rounded-full w-12 h-12 shadow-sm" alt="Agent icon" />
          </div>
          <div
            v-else
            :class="[
              bgRandomColor(),
              'flex-shrink-0 rounded-full w-12 h-12 flex items-center justify-center shadow-sm',
            ]"
          >
            <span class="text-white text-lg font-semibold tracking-wider">{{
              item.name.slice(0, 1)
            }}</span>
          </div>
          <div class="flex-grow flex flex-col overflow-hidden">
            <div
              class="flex items-center justify-between font-semibold text-sm text-gray-800 dark:text-gray-200 mb-0.5"
            >
              <span
                class="line-clamp-1 overflow-hidden text-ellipsis block flex-grow mr-2 whitespace-nowrap"
              >
                {{ item.name }}
              </span>
              <Star
                :theme="isMineAgent(item) ? 'filled' : 'outline'"
                size="16"
                :fill="isMineAgent(item) ? '#facc15' : 'currentColor'"
                class="btn-icon-action cursor-pointer flex-shrink-0 group-hover:text-yellow-400 dark:group-hover:text-yellow-500"
                @click.stop="handleCollect(item)"
              />
            </div>

            <!-- Display category names -->
            <div
              v-if="item.catName"
              class="flex flex-nowrap items-center mb-1.5 overflow-x-auto scrollbar-hide"
              style="gap: 4px"
            >
              <span
                v-for="(catName, index) in item.catName.split(',')"
                :key="index"
                class="text-xs px-2 py-0.5 border rounded-md cursor-pointer flex items-center whitespace-nowrap transition-colors duration-150 bg-white border-gray-100 text-gray-500 hover:bg-primary-50 hover:text-primary-600 dark:bg-gray-700 dark:border-gray-750 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-300"
                @click.stop="handleClickCategoryTag(catName.trim())"
              >
                <span>{{ catName.trim() }}</span>
                <span
                  v-if="isMemberCategory(catName.trim())"
                  class="ml-0.5 text-yellow-500 inline-flex items-center"
                  ><VipOne size="12"
                /></span>
              </span>
            </div>

            <span class="text-xs line-clamp-2 text-gray-500/90 dark:text-gray-400/80">
              {{ item.des }}
            </span>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for Chrome, Safari and Opera */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
