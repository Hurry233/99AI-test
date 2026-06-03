/**
 * Agent platform feature gates.
 *
 * Keep legacy marketplace/plugin capabilities behind explicit switches so the
 * chat shell defaults to first-class Agent workflows while preserving a safe
 * rollback path for deployments that still rely on old data.
 */
export const agentPlatformFeatures = {
  /**
   * Legacy marketplace-style plugins are deprecated in the chat shell.
   * Native tools, model capabilities, and Agent shortcuts should be preferred.
   */
  legacyPluginMarketplace: false,

  /** Allow users to mention an Agent with @ from the composer. */
  agentShortcutSearch: true,

  /** Mermaid is treated as a native diagram tool rather than a legacy plugin. */
  mermaidDiagramTool: true,
} as const
