import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMeasureInput, SessionUsage } from 'claude-code'

import type { Meter, Totals } from '../types'

const STORE_KEY = 'isVisible'
const USAGE_HINT = 'Usage: /tokens [on|off]. With no argument it toggles the meter.'

const isVisible = atom({ plugin: 'token-meter', key: 'isVisible' } as const, true)
// Bump a shape tag when that value's fields change: older stored values then read as null.
const totals = atom({ plugin: 'token-meter', key: 'totals' } as const, null, { shape: 'totals-3' })
const meter = atom({ plugin: 'token-meter', key: 'meter' } as const, null, { shape: 'meter-1' })

const fmt = (n: number): string => {
  // Pick the unit from the rounded value, so 999_600 reads 1.00M rather than 1000k.
  if (Math.round(n / 1_000_000) >= 1000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (Math.round(n / 1000) >= 1000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.round(n / 100) >= 100) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const usd = (n: number): string => (n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`)

/** Whether a dollar amount reaches a cent, without float noise (0.1 - 0.09 is 0.00999…). */
const isCentOrMore = (n: number): boolean => Math.round(n * 1e6) >= 10_000

const LIMIT_NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

const levelColor = (pct: number): string => (pct >= 85 ? 'error' : pct >= 60 ? 'warning' : 'success')

const emptyTotals = (startedAt: number, costAtStart: number, isPending = false): Totals => ({
  startedAt,
  costAtStart,
  isPending,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  turns: 0,
})

/** Cost spent since the totals started. A ledger below the baseline was itself reset. */
const spentSince = (ledger: number, t: Totals | null): number => {
  const raw = !t ? ledger : ledger >= t.costAtStart ? ledger - t.costAtStart : ledger
  return Math.round(raw * 1e6) / 1e6 // drop float noise such as 5.01 - 5 = 0.00999…
}

const toMeter = (u: SessionUsage): Meter => ({
  usd: u.cost?.usd,
  contextTokens: u.context.tokens,
  window: u.context.window,
  percent: u.context.percent,
  limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
})

/**
 * Bring the totals in line with the conversation the engine reports now.
 *
 * `at` says when: at a prompt or a load of the mod, before any turn has spent, the ledger is
 * where a new conversation starts; after a turn it already holds that turn's cost, and since
 * the engine restarts its ledger at /clear, a new conversation found then counts from zero.
 *
 * Pending (after /clear or /resume) settles at the next prompt, by which the engine reports
 * the new conversation even when its startedAt matches the old one (a /resume back to it),
 * or at any point the startedAt changes. A load alone never settles it on stale figures.
 * `measured` is a session.measure event's own figures, preferred to a fresh read.
 */
const sync = async (
  $: EngineInterface,
  at: 'prompt' | 'load' | 'turn',
  measured?: SessionMeasureInput,
): Promise<void> => {
  const current = await $.session.usage()
  const usage: SessionUsage = measured
    ? { ...current, context: measured.context, rateLimits: measured.rateLimits, cost: measured.cost }
    : current
  const ledger = usage.cost?.usd ?? 0

  await update($, totals, prev => {
    if (!prev) return emptyTotals(usage.startedAt, ledger)
    const isNewConversation = usage.startedAt !== prev.startedAt
    const base = at === 'turn' ? 0 : ledger
    // One /clear or /resume announced: keep what counted since it.
    if (prev.isPending && (at === 'prompt' || isNewConversation)) {
      return { ...prev, startedAt: usage.startedAt, costAtStart: base, isPending: false }
    }
    // One nothing announced: start over.
    if (!prev.isPending && isNewConversation) return emptyTotals(usage.startedAt, base)
    // Same conversation. A ledger that fell below the baseline was reset: measure from zero.
    return !prev.isPending && ledger < prev.costAtStart ? { ...prev, costAtStart: 0 } : prev
  })

  // While pending, the engine still reports the conversation that ended: keep the cleared view.
  if (!(await read($, totals))?.isPending) await update($, meter, () => toMeter(usage))
}

const setVisible = async ($: EngineInterface, value: boolean): Promise<void> => {
  await update($, isVisible, () => value)
  await $.store.set(STORE_KEY, value)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tokens',
      description: 'Toggle the token / cost / usage meter above the prompt (on | off)',
    })

    const saved = await $.store.get(STORE_KEY)
    if (typeof saved === 'boolean') await update($, isVisible, () => saved)

    // A reload of the mod runs session.start again: sync keeps the totals it already has.
    await sync($, 'load')

    return next(e)
  })

  // /clear and /resume end the conversation without a new session.start. At this point the
  // engine still reports the old conversation's figures, so zero the counters now and settle
  // the cost baseline once the new conversation shows (the next prompt, at the latest a turn).
  on('session.end', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'clear' || e.reason === 'resume') {
      const { startedAt } = await $.session.usage()
      await update($, totals, prev => emptyTotals(prev?.startedAt ?? startedAt, 0, true))
      await update($, meter, prev => prev && { ...prev, contextTokens: undefined, percent: undefined })
    }

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    await sync($, 'prompt')

    return next(e)
  })

  on('command.run', { command: 'tokens' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: USAGE_HINT }

    const value = arg === 'on' ? true : arg === 'off' ? false : !(await read($, isVisible))
    await setVisible($, value)

    return { text: value ? 'Token meter on.' : 'Token meter off. Run /tokens to show it again.' }
  })

  // Sum each turn's token counts, subagent turns included, since they bill too.
  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    if (u) {
      await sync($, 'turn')
      await update($, totals, prev =>
        prev && {
          ...prev,
          input: prev.input + u.input_tokens,
          output: prev.output + u.output_tokens,
          cacheRead: prev.cacheRead + u.cache_read_input_tokens,
          cacheWrite: prev.cacheWrite + u.cache_creation_input_tokens,
          turns: prev.turns + (e.agentId ? 0 : 1),
        },
      )
    }

    return next(e)
  })

  // Cost ledger, context fill and rate limits, measured by the engine after each turn.
  on('session.measure', async ($, e, next) => {
    await sync($, 'turn', e)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isVisible))) return next(e)

    const t = await read($, totals)
    const m = await read($, meter)
    const { Box, Text } = $.ui.resolve(e)

    const ledger = m?.usd
    const spent = ledger === undefined ? undefined : t?.isPending ? 0 : spentSince(ledger, t)
    // Shown when the session's bill covers more than the counted span (a resumed session).
    const isPartial = !t?.isPending && ledger !== undefined && spent !== undefined && isCentOrMore(ledger - spent)
    const contextPct = m?.percent

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text>
          <Text dimColor>tokens </Text>
          <Text>in {fmt(t?.input ?? 0)}</Text>
          <Text dimColor> · </Text>
          <Text>out {fmt(t?.output ?? 0)}</Text>
          <Text dimColor> · cache r {fmt(t?.cacheRead ?? 0)} w {fmt(t?.cacheWrite ?? 0)}</Text>
        </Text>
        <Text>
          <Text dimColor>cost </Text>
          <Text color="claude" bold>
            {spent === undefined ? 'n/a' : usd(spent)}
          </Text>
          {t && t.turns > 0 && spent !== undefined && <Text dimColor> ({usd(spent / t.turns)}/turn)</Text>}
          {isPartial && ledger !== undefined && <Text dimColor> · session {usd(ledger)}</Text>}
        </Text>
        <Text>
          <Text dimColor>ctx </Text>
          {contextPct === undefined ? (
            <Text dimColor>–</Text>
          ) : (
            <Text color={levelColor(contextPct)}>
              {contextPct}% <Text dimColor>({fmt(m?.contextTokens ?? 0)}/{fmt(m?.window ?? 0)})</Text>
            </Text>
          )}
        </Text>
        {(m?.limits ?? []).length > 0 && (
          <Text>
            <Text dimColor>usage </Text>
            {(m?.limits ?? []).map((l, i) => (
              <Text>
                {i > 0 && <Text dimColor> · </Text>}
                <Text dimColor>{LIMIT_NAMES[l.kind] ?? l.kind} </Text>
                <Text color={levelColor(l.percentUsed)}>{l.percentUsed}%</Text>
              </Text>
            ))}
          </Text>
        )}
      </Box>
    )
  })
}
