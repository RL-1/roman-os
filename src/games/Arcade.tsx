// A handheld brick-game console in a window: one LCD of 10×20 cells, three cartridges.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { sound } from '../sound'
import { COLS, GAMES, ROWS, type Cart, type Fx, type GameId, type Pad } from './carts'

type Phase = 'title' | 'play' | 'pause' | 'curtain' | 'over'

const KEYS: Record<string, Pad> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyX: 'rotate',
  KeyZ: 'rotate',
  Space: 'drop',
}

const best = {
  get(id: GameId) {
    try {
      return Number(localStorage.getItem(`ros:best:${id}`)) || 0
    } catch {
      return 0
    }
  },
  set(id: GameId, n: number) {
    try {
      localStorage.setItem(`ros:best:${id}`, String(n))
    } catch {
      /* private mode: the record lasts this visit */
    }
  },
}

const play = (fx: Fx) => {
  if (fx.startsWith('line')) sound.line(Number(fx.slice(4)))
  else sound[fx as Exclude<Fx, `line${number}`>]()
}

const six = (n: number) => String(n).padStart(6, '0')

// an LCD cell: a square frame with a square dot inside, lit or ghosted
function paint(cv: HTMLCanvasElement, cell: number, lit: (i: number, y: number) => boolean) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const p = getComputedStyle(cv).getPropertyValue('--p-hi').trim() || '255 196 92'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, COLS * cell, ROWS * cell)
  const pad = Math.max(1, Math.round(cell * 0.07))
  const bw = Math.max(1, Math.round(cell * 0.1))
  const inset = bw + Math.max(1, Math.round(cell * 0.11))
  const s = cell - 2 * pad
  for (const on of [false, true]) {
    ctx.fillStyle = on ? `rgb(${p})` : `rgb(${p} / 0.075)`
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x
        if (lit(i, y) !== on) continue
        const x0 = x * cell + pad
        const y0 = y * cell + pad
        ctx.fillRect(x0, y0, s, bw)
        ctx.fillRect(x0, y0 + s - bw, s, bw)
        ctx.fillRect(x0, y0 + bw, bw, s - 2 * bw)
        ctx.fillRect(x0 + s - bw, y0 + bw, bw, s - 2 * bw)
        ctx.fillRect(x0 + inset, y0 + inset, s - 2 * inset, s - 2 * inset)
      }
  }
}

const ARROW: Record<'left' | 'right' | 'up' | 'down', string> = {
  up: 'M5 1h2v1h1v1h1v1h1v2H8V5H7v6H5V5H4v1H2V4h1V3h1V2h1z',
  down: 'M5 11h2v-1h1V9h1V8h1V6H8v1H7V1H5v6H4V6H2v2h1v1h1v1h1z',
  left: 'M1 5v2h1v1h1v1h1v1h2V8H5V7h6V5H5V4h1V2H4v1H3v1H2v1z',
  right: 'M11 5v2h-1v1H9v1H8v1H6V8h1V7H1V5h6V4H6V2h2v1h1v1h1v1z',
}

export function ArcadeApp({ game: wanted, active }: { game?: GameId; active: boolean }) {
  const [game, setGame] = useState<GameId>(wanted ?? 'snake')
  const meta = GAMES.find((g) => g.id === game)!
  const cart = useRef<Cart>(meta.make())
  const [phase, setPhase] = useState<Phase>('title')
  const [curtain, setCurtain] = useState(0)
  const [, setFrame] = useState(0)
  const [record, setRecord] = useState(() => best.get(game))
  const [isNew, setIsNew] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const lcd = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [{ cell, col }, setFit] = useState({ cell: 16, col: false })
  const activeRef = useRef(active)
  activeRef.current = active
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const choose = useCallback((id: GameId) => {
    const g = GAMES.find((x) => x.id === id)!
    cart.current = g.make()
    setGame(id)
    setPhase('title')
    setCurtain(0)
    setIsNew(false)
    setRecord(best.get(id))
  }, [])

  // a terminal command or a deep link can ask for another cartridge while the window is open
  useEffect(() => {
    if (wanted && wanted !== game) choose(wanted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  // the board takes whatever room the window gives it, in whole cells
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      // a tall window (a phone) puts the controls under the board, a wide one beside it
      const col = height > width * 1.25
      const side = width < 400 ? 132 : 184
      const c = col ? Math.min((width - 16) / COLS, (height - 210 - 16) / ROWS) : Math.min((width - side - 16 - 16) / COLS, (height - 16) / ROWS)
      setFit({ cell: Math.max(7, Math.floor(c)), col })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const cv = canvas.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(COLS * cell * dpr)
    const h = Math.round(ROWS * cell * dpr)
    if (cv.width !== w || cv.height !== h) {
      cv.width = w
      cv.height = h
    }
    const ph = phaseRef.current
    const cells = cart.current.cells()
    if (ph === 'curtain' || ph === 'over') {
      // fill from the bottom up, then wipe from the top down, like the handhelds did
      const c = ph === 'over' ? 2 * ROWS : curtain
      paint(cv, cell, (_, y) => (c <= ROWS ? y >= ROWS - c : y >= c - ROWS))
      return
    }
    paint(cv, cell, (i) => cells[i] === 1)
  }, [cell, curtain])

  // every render repaints, so a phosphor change on the monitor shows at once
  useEffect(() => draw())

  const flush = useCallback(() => {
    const c = cart.current
    for (const fx of c.fx) play(fx)
    c.fx = []
    setFrame((f) => f + 1)
    if (c.over && phaseRef.current === 'play') {
      phaseRef.current = 'curtain'
      setPhase('curtain')
    }
  }, [])

  // the clock: one tick per game step, at the speed the cartridge asks for
  useEffect(() => {
    if (phase !== 'play') return
    let t = 0
    const step = () => {
      cart.current.tick()
      flush()
      if (!cart.current.over) t = window.setTimeout(step, cart.current.speed())
    }
    t = window.setTimeout(step, cart.current.speed())
    return () => clearTimeout(t)
  }, [phase, flush])

  useEffect(() => {
    if (phase !== 'curtain') return
    if (curtain >= 2 * ROWS) {
      const score = cart.current.score
      if (score > best.get(game)) {
        best.set(game, score)
        setRecord(score)
        setIsNew(true)
      }
      setPhase('over')
      return
    }
    const t = setTimeout(() => setCurtain((c) => c + 1), 28)
    return () => clearTimeout(t)
  }, [phase, curtain, game])

  const focusBoard = () => lcd.current?.focus({ preventScroll: true })

  const start = useCallback(() => {
    const ph = phaseRef.current
    if (ph === 'play') setPhase('pause')
    else if (ph === 'pause') setPhase('play')
    else if (ph === 'title' || ph === 'over') {
      cart.current = GAMES.find((g) => g.id === game)!.make()
      setCurtain(0)
      setIsNew(false)
      sound.start()
      setPhase('play')
    }
  }, [game])

  const press = useCallback(
    (k: Pad) => {
      if (phaseRef.current !== 'play') return
      cart.current.press(k)
      flush()
    },
    [flush],
  )

  // pause when the window loses focus or the tab is hidden
  useEffect(() => {
    if (!active && phaseRef.current === 'play') setPhase('pause')
  }, [active])
  useEffect(() => {
    const onHide = () => document.hidden && phaseRef.current === 'play' && setPhase('pause')
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // keys work while this window has focus
  useEffect(() => {
    const mine = () => {
      const win = area.current?.closest('.win')
      const el = document.activeElement
      return !!win && (win.contains(el) || ((!el || el === document.body) && activeRef.current))
    }
    const down = (e: KeyboardEvent) => {
      if (!mine() || e.metaKey || e.ctrlKey || e.altKey) return
      const onButton = (document.activeElement as HTMLElement | null)?.matches('button')
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyP') {
        if (onButton && e.code !== 'KeyP') return
        e.preventDefault()
        if (!e.repeat) start()
        return
      }
      const k = KEYS[e.code]
      if (!k || (onButton && k === 'drop')) return
      e.preventDefault()
      if (phaseRef.current === 'title' || phaseRef.current === 'over') {
        if (!e.repeat && k !== 'drop') start()
        return
      }
      press(k)
    }
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.code]
      if (k) cart.current.release(k)
    }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    return () => {
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
    }
  }, [press, start])

  // on-screen buttons repeat while held, like a keyboard does
  const held = useRef<{ k: Pad; t: number } | null>(null)
  const letGo = useCallback(() => {
    const h = held.current
    if (!h) return
    clearTimeout(h.t)
    clearInterval(h.t)
    cart.current.release(h.k)
    held.current = null
  }, [])
  useEffect(() => {
    addEventListener('pointerup', letGo)
    addEventListener('pointercancel', letGo)
    return () => {
      removeEventListener('pointerup', letGo)
      removeEventListener('pointercancel', letGo)
    }
  }, [letGo])
  const padDown = (k: Pad) => (e: RPointerEvent) => {
    e.preventDefault()
    letGo()
    focusBoard()
    if (phaseRef.current === 'title' || phaseRef.current === 'over') {
      start()
      return
    }
    press(k)
    const repeats = k === 'left' || k === 'right' || k === 'down'
    held.current = { k, t: repeats ? window.setTimeout(() => held.current && (held.current.t = window.setInterval(() => press(k), 70)), 220) : 0 }
  }

  const c = cart.current
  const shown = phase === 'title' ? 0 : c.score
  const btn = (k: Pad, label: string, body: ReactNode, cls = '') => (
    <button className={`pad-btn ${cls}`} aria-label={label} title={label} onPointerDown={padDown(k)} onClick={(e) => e.detail === 0 && press(k)}>
      {body}
    </button>
  )
  const arrow = (k: keyof typeof ARROW) => (
    <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      <path d={ARROW[k]} fill="currentColor" />
    </svg>
  )

  return (
    <div className={`arcade${col ? ' is-col' : ''}`} ref={area}>
      <div className="lcd" ref={lcd} tabIndex={-1} role="img" aria-label={`${meta.name} game board`} style={{ width: COLS * cell + 16, height: ROWS * cell + 16, ['--cell' as string]: `${cell}px` }}>
        <canvas ref={canvas} style={{ width: COLS * cell, height: ROWS * cell }} />
        {phase !== 'play' && phase !== 'curtain' && (
          <div className="lcd-msg" role="status">
            {phase === 'title' && (
              <>
                <b>{meta.name}</b>
                <ul>
                  {meta.keys.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
                <span className="blink">Press Enter</span>
              </>
            )}
            {phase === 'pause' && (
              <>
                <b>Pause</b>
                <span>Enter to go on</span>
              </>
            )}
            {phase === 'over' && (
              <>
                <b>Game over</b>
                <span className="big">{six(c.score)}</span>
                {isNew && <span className="blink">New record!</span>}
                <span className="dim">Enter to retry</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="arcade-side">
        <div className="carts" role="tablist" aria-label="Cartridge">
          {GAMES.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={g.id === game}
              className="tab"
              onClick={() => {
                sound.click()
                if (g.id !== game) choose(g.id)
                focusBoard()
              }}
            >
              {g.name}
            </button>
          ))}
        </div>

        <dl className="lcd-stats">
          <div>
            <dt>Score</dt>
            <dd>{six(shown)}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd>{six(record)}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{phase === 'title' ? 1 : c.level}</dd>
          </div>
          <div>
            <dt>{meta.counter}</dt>
            <dd>{phase === 'title' ? 0 : c.count}</dd>
          </div>
        </dl>

        {game === 'blocks' && c.next && (
          <div className="lcd-next" aria-label="Next piece">
            <span>Next</span>
            <div className="next-grid" style={{ gridTemplateColumns: `repeat(${c.next.length}, auto)` }}>
              {c.next
                .filter((row) => row.some(Boolean))
                .flat()
                .map((v, i) => (
                  <i key={i} className={v ? 'is-on' : ''} />
                ))}
            </div>
          </div>
        )}

        <div className="pad" role="group" aria-label="Controls">
          {game === 'blocks' ? btn('rotate', 'Rotate', '⟳', 'pad-word') : <span />}
          {btn('up', game === 'racer' ? 'Speed up' : game === 'blocks' ? 'Rotate' : 'Up', arrow('up'))}
          {game === 'blocks' ? btn('drop', 'Slam down', '⤓', 'pad-word') : <span />}
          {btn('left', 'Left', arrow('left'))}
          {btn('down', 'Down', arrow('down'))}
          {btn('right', 'Right', arrow('right'))}
          <button
            className="pad-btn pad-start"
            onPointerDown={(e) => {
              e.preventDefault()
              focusBoard()
              start()
            }}
            onClick={(e) => e.detail === 0 && start()}
          >
            {phase === 'play' ? 'Pause' : phase === 'pause' ? '▶ Go on' : '▶ Start'}
          </button>
        </div>
      </div>
    </div>
  )
}
