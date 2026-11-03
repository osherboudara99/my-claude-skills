/**
 * Tokens summed over every turn since the meter started counting (session start or the
 * last /clear), main loop and subagents. `costAtStart` is the cost ledger at that moment,
 * so cost and tokens cover the same span. `isPending` is set from /clear or /resume until
 * the engine reports the new conversation (it still reports the old one at session.end).
 */
export type Totals = {
  startedAt: number
  costAtStart: number
  isPending: boolean
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  turns: number
}

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** The engine's latest measurement: cost ledger, context fill, rate limits. */
export type Meter = {
  usd?: number
  contextTokens?: number
  window: number
  percent?: number
  limits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    'token-meter': {
      isVisible: boolean
      totals: Shaped<Totals | null>
      meter: Shaped<Meter | null>
    }
  }
}
