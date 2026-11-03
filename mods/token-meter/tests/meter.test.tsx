import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'token-meter',
    component: 'AbovePrompt',
    surface,
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns: 120,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  }) as const

type Usage = {
  startedAt: number
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: { kind: string; percentUsed: number }[]
  cost?: { usd: number }
}

// Stand in for the engine beneath the plugin. `ledger.usage` is what $.session.usage() answers;
// a test changes it to move the clock (startedAt) or the cost ledger.
const engine = (on: On, usage: Usage) => {
  const ledger = { usage }
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('command.register', () => ({ value: { command: 'tokens' } }))
  on('session.usage', () => ({ value: ledger.usage }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return ledger
}

const FRESH: Usage = {
  startedAt: 1000,
  context: { tokens: 90_000, window: 200_000, percent: 45 },
  rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }],
  cost: { usd: 0 },
}

const turn = (turnId: string, input = 1200, output = 3400) =>
  ({
    answer: 'hi',
    durationMs: 10,
    isAborted: false,
    turnId,
    reason: 'answer',
    usage: {
      model: 'claude-opus-5-5',
      input_tokens: input,
      output_tokens: output,
      cache_read_input_tokens: 50_000,
      cache_creation_input_tokens: 8000,
    },
  }) as const

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const prompt = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } }) as const

const text = async (ui: { find: (q: { type: string; text: RegExp }) => Promise<{ text: string } | undefined> }, re: RegExp) =>
  (await ui.find({ type: 'Text', text: re }))?.text

test('the band shows tokens, cost, context and usage, and /tokens toggles it', async ($, on) => {
  engine(on, FRESH)
  await $.session.start(START)
  await $.turn.complete(turn('t1'))
  await $.turn.complete(turn('t2'))
  await $.session.measure({ ...FRESH, cost: { usd: 2.25 }, changed: ['cost'] })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface))
    expect(await text(ui, /^in /)).toBe('in 2.4k')
    expect(await text(ui, /^out /)).toBe('out 6.8k')
    expect(await text(ui, /^\$/)).toBe('$2.25')
    expect(await text(ui, /^ \(.*\/turn/)).toBe(' ($1.13/turn)')
    expect(await text(ui, /session \$/)).toBeUndefined()
    expect(await text(ui, /^45%/)).toContain('90k/200k')
    expect(await text(ui, /^23.5%$/)).toBe('23.5%')
    await ui.unmount()
  }

  const off = await $.command.run({ command: 'tokens', args: 'off' } as never)
  expect(off.text).toContain('off')
  let ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /engine/)).toBe('engine')
  await ui.unmount()

  await $.command.run({ command: 'tokens', args: '' } as never)
  ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /engine/)).toBeUndefined()
  await ui.unmount()
})

test('an unknown /tokens argument shows usage and changes nothing', async ($, on) => {
  engine(on, FRESH)
  await $.session.start(START)

  const r = await $.command.run({ command: 'tokens', args: 'bogus' } as never)
  expect(r.text).toContain('Usage: /tokens [on|off]')

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /engine/)).toBeUndefined()
  await ui.unmount()
})

const CLEAR = { reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never

// As the live engine does: at session.end it still reports the conversation that ended; by the
// next prompt it reports the new one, its ledger restarted at zero.
test('/clear resets the counters at once', async ($, on) => {
  const ledger = engine(on, FRESH)
  await $.session.start(START)
  await $.turn.complete(turn('t1'))
  ledger.usage = { ...FRESH, cost: { usd: 3 } }
  await $.session.measure({ ...FRESH, cost: { usd: 3 }, changed: ['cost'] })

  await $.session.end(CLEAR) // the engine still reports $3 and 45% here

  let ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 0')
  expect(await text(ui, /^\$/)).toBe('$0.00')
  expect(await text(ui, /\/turn/)).toBeUndefined()
  expect(await text(ui, /session \$/)).toBeUndefined()
  expect(await text(ui, /^ctx/)).toBe('ctx –')
  await ui.unmount()

  // The new conversation: its first prompt, then a turn costing $0.50.
  ledger.usage = { ...FRESH, startedAt: 5000, context: { window: 200_000 }, cost: { usd: 0 } }
  await $.prompt.submit(prompt('hi'))
  ledger.usage = { ...FRESH, startedAt: 5000, cost: { usd: 0.5 } }
  await $.turn.complete(turn('t2', 100, 200))
  await $.session.measure({ ...FRESH, cost: { usd: 0.5 }, changed: ['cost'] })

  ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 100')
  expect(await text(ui, /^\$/)).toBe('$0.50')
  expect(await text(ui, /^ \(.*\/turn/)).toBe(' ($0.50/turn)')
  expect(await text(ui, /session \$/)).toBeUndefined()
  expect(await text(ui, /^45%/)).toContain('90k/200k')
  await ui.unmount()
})

test('a first turn after /clear costing more than the old conversation counts in full', async ($, on) => {
  const ledger = engine(on, { ...FRESH, cost: { usd: 0 } })
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 0.3 } }
  await $.turn.complete(turn('t1'))
  await $.session.end(CLEAR)

  ledger.usage = { ...FRESH, startedAt: 5000, cost: { usd: 0 } }
  await $.prompt.submit(prompt('rebuild a big context'))
  ledger.usage = { ...FRESH, startedAt: 5000, cost: { usd: 0.5 } }
  await $.turn.complete(turn('t2'))
  await $.session.measure({ ...FRESH, cost: { usd: 0.5 }, changed: ['cost'] })

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^\$/)).toBe('$0.50')
  expect(await text(ui, /session \$/)).toBeUndefined()
  await ui.unmount()
})

test('after /clear, a turn with no prompt before it still counts from zero', async ($, on) => {
  const ledger = engine(on, FRESH)
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 2 } }
  await $.turn.complete(turn('t1'))
  await $.session.end(CLEAR)

  ledger.usage = { ...FRESH, startedAt: 5000, cost: { usd: 0.25 } }
  await $.turn.complete(turn('t2', 10, 20))

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 10')
  expect(await text(ui, /^\$/)).toBe('$0.25')
  await ui.unmount()
})

test('/resume inside a session counts from the resume and shows the resumed bill beside it', async ($, on) => {
  const ledger = engine(on, FRESH)
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 2 } }
  await $.turn.complete(turn('t1'))
  await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's1' } } as never)

  // The resumed conversation's ledger holds $5 from its earlier runs.
  ledger.usage = { ...FRESH, startedAt: 500, cost: { usd: 5 } }
  await $.prompt.submit(prompt('carry on'))
  ledger.usage = { ...FRESH, startedAt: 500, cost: { usd: 6 } }
  await $.turn.complete(turn('t2'))
  await $.session.measure({ ...FRESH, cost: { usd: 6 }, changed: ['cost'] })

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 1.2k')
  expect(await text(ui, /^\$/)).toBe('$1.00')
  expect(await text(ui, /^ · session/)).toBe(' · session $6.00')
  await ui.unmount()
})

test('other session endings do not reset the counters', async ($, on) => {
  engine(on, FRESH)
  await $.session.start(START)
  await $.turn.complete(turn('t1'))
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1', resume: { id: 's1' } } as never)

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 1.2k')
  await ui.unmount()
})

test('cents are counted without float noise', async ($, on) => {
  // Resumed at launch with $5 on the ledger; one cent spent since.
  const ledger = engine(on, { ...FRESH, cost: { usd: 5 } })
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 5.01 } }
  await $.session.measure({ ...FRESH, cost: { usd: 5.01 }, changed: ['cost'] })

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^\$/)).toBe('$0.01')
  expect(await text(ui, /^ · session/)).toBe(' · session $5.01')
  await ui.unmount()
})

test('a resumed session counts cost from now and shows the full session bill beside it', async ($, on) => {
  // The ledger already holds $5 from before the resume; its tokens are not recoverable.
  const ledger = engine(on, { ...FRESH, cost: { usd: 5 } })
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 6 } }
  await $.turn.complete(turn('t1'))
  await $.session.measure({ ...FRESH, cost: { usd: 6 }, changed: ['cost'] })

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^\$/)).toBe('$1.00')
  expect(await text(ui, /^ \(.*\/turn/)).toBe(' ($1.00/turn)')
  expect(await text(ui, /^ · session/)).toBe(' · session $6.00')
  await ui.unmount()
})

test('a reload of the mod keeps the totals', async ($, on) => {
  engine(on, FRESH)
  await $.session.start(START)
  await $.turn.complete(turn('t1'))
  await $.session.start(START) // session.start runs again on a hot reload

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 1.2k')
  await ui.unmount()
})

test('token counts near a unit boundary take the larger unit', async ($, on) => {
  engine(on, FRESH)
  await $.session.start(START)
  await $.turn.complete(turn('t1', 999_600, 9960))

  let ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 1.00M')
  expect(await text(ui, /^out /)).toBe('out 10k')
  await ui.unmount()

  await $.turn.complete(turn('t2', 1_499_000_400, 0))
  ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 1.50B')
  await ui.unmount()
})

test('/resume back to a conversation with the same startedAt settles at the next prompt', async ($, on) => {
  const ledger = engine(on, FRESH)
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 2 } }
  await $.turn.complete(turn('t1'))
  await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's1' } } as never)

  // The resumed conversation keeps its stored startedAt (1000, as before) and a $2 ledger.
  await $.prompt.submit(prompt('carry on'))
  ledger.usage = { ...FRESH, cost: { usd: 4 } }
  await $.turn.complete(turn('t2'))
  await $.session.measure({ ...FRESH, cost: { usd: 4 }, changed: ['cost'] })

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^\$/)).toBe('$2.00')
  expect(await text(ui, /^ · session/)).toBe(' · session $4.00')
  expect(await text(ui, /^45%/)).toContain('90k/200k')
  await ui.unmount()
})

test('a reload while pending does not settle on the old conversation', async ($, on) => {
  const ledger = engine(on, FRESH)
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 3 } }
  await $.turn.complete(turn('t1'))
  await $.session.end(CLEAR)
  await $.session.start(START) // hot reload; the engine still reports the old $3

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^in /)).toBe('in 0')
  expect(await text(ui, /^\$/)).toBe('$0.00')
  expect(await text(ui, /^ctx/)).toBe('ctx –')
  await ui.unmount()
})

test('no session note for a gap under a cent', async ($, on) => {
  // Figures from a live --resume run: $0.00594 restored, $0.00042 spent since.
  const ledger = engine(on, { ...FRESH, cost: { usd: 0.00594 } })
  await $.session.start(START)
  ledger.usage = { ...FRESH, cost: { usd: 0.00636 } }
  await $.session.measure({ ...FRESH, cost: { usd: 0.00636 }, changed: ['cost'] })

  const ui = await $.ui.mount(BAND('terminal'))
  expect(await text(ui, /^<\$/)).toBe('<$0.01')
  expect(await text(ui, /session/)).toBeUndefined()
  await ui.unmount()
})
