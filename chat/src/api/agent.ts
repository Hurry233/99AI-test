import {
  fetchCollectAppAPI,
  fetchQueryAppCatsAPI,
  fetchQueryAppsAPI,
  fetchQueryOneCatAPI,
} from './appStore'

export interface AgentItem {
  id: number
  name: string
  des: string
  coverImg: string
  catId: string | number
  appCount: number
  demoData: string
  loading?: boolean
  createdAt: string
  updatedAt: string
  catName?: string
  backgroundImg?: string
  prompt?: string
  model?: string
}

export interface AgentCategory {
  id: number
  name: string
  coverImg: string
  des: string
  isMember?: number
}

export function fetchQueryAgentsAPI<T = any>(params?: any): Promise<T> {
  return fetchQueryAppsAPI(params)
}

export function fetchQueryAgentCategoriesAPI<T = any>(params?: any): Promise<T> {
  return fetchQueryAppCatsAPI(params)
}

export function fetchQueryOneAgentAPI<T = any>(params: { id: number }): Promise<T> {
  return fetchQueryOneCatAPI(params)
}

export function fetchCollectAgentAPI<T = any>(data: { appId: number }): Promise<T> {
  return fetchCollectAppAPI(data)
}
