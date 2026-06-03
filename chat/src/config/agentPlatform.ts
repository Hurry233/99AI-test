/**
 * Agent platform feature gates.
 *
 * Keep legacy marketplace/plugin capabilities behind explicit switches so the
 * chat shell defaults to first-class Agent workflows while preserving a safe
 * rollback path for deployments that still rely on old data.
 */

type FeatureKey = 'legacyPluginMarketplace' | 'agentShortcutSearch' | 'mermaidDiagramTool'

type FeatureMap = Record<FeatureKey, boolean>

const defaults: FeatureMap = {
  /**
   * Legacy marketplace-style plugins are deprecated in the chat shell.
   * Native tools, model capabilities, and Agent shortcuts should be preferred.
   */
  legacyPluginMarketplace: false,

  /** Allow users to mention an Agent with @ from the composer. */
  agentShortcutSearch: true,

  /** Mermaid is treated as a native diagram tool rather than a legacy plugin. */
  mermaidDiagramTool: true,
}

const envKeys: Record<FeatureKey, string> = {
  legacyPluginMarketplace: 'VITE_AGENT_LEGACY_PLUGIN_MARKETPLACE',
  agentShortcutSearch: 'VITE_AGENT_SHORTCUT_SEARCH',
  mermaidDiagramTool: 'VITE_AGENT_MERMAID_DIAGRAM_TOOL',
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false

  return undefined
}

function getLocalOverride(key: FeatureKey): boolean | undefined {
  if (typeof window === 'undefined') return undefined

  const value = window.localStorage.getItem(`agentPlatform.${key}`)
  return parseBoolean(value)
}

function getFeatureValue(key: FeatureKey): boolean {
  const envValue = parseBoolean(import.meta.env[envKeys[key]])
  const localOverride = getLocalOverride(key)

  return localOverride ?? envValue ?? defaults[key]
}

export const agentPlatformFeatures: FeatureMap = {
  legacyPluginMarketplace: getFeatureValue('legacyPluginMarketplace'),
  agentShortcutSearch: getFeatureValue('agentShortcutSearch'),
  mermaidDiagramTool: getFeatureValue('mermaidDiagramTool'),
}
