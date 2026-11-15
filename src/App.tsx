import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { AboutApp, ContactApp, CvApp, ExperienceApp, PostsApp, ProjectApp, ProjectsApp, SkillsApp, winMeta } from './apps'
import { experience, profile, projects } from './data'
import { Hardware, Osd, type Power, type Spot } from './Hardware'
import { PixelIcon } from './icons'
import room from './room.json'
import { sound } from './sound'
import { ArcadeApp } from './games/Arcade'
import { GAMES, type GameId } from './games/carts'
import { TerminalApp } from './Terminal'
import { APPS, reducer, type AppId, type Win } from './wm'

// read once, before the URL sync below can rewrite it
const initialHash = decodeURIComponent(location.hash.slice(1))

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const PHONE = '(max-width: 760px), (max-aspect-ratio: 23/20)'
const isPhone = () => window.matchMedia(PHONE).matches

const asset = (p: string) => import.meta.env.BASE_URL + p

// Where the glass sits in the rendered photo (scene/room.py writes these numbers), as fractions of the picture.
const ROOM = room

// Old tubes bulge: the picture is magnified at the centre and squeezed towards the edges.
// An SVG displacement map does it to live HTML. Safari draws SVG filters on HTML unreliably, so it keeps a flat screen.
const BARREL = 0.032
const LEVELS = [0.72, 0.86, 1, 1.14, 1.28]
const barrelOk = () => /Chrome|Firefox/.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

function barrelMap(aspect: number) {
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(N, N)
  const ax = aspect >= 1 ? 1 : aspect
  const ay = aspect >= 1 ? 1 / aspect : 1
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const u = ((i + 0.5) / N) * 2 - 1
      const v = ((j + 0.5) / N) * 2 - 1
      const r2 = u * u + v * v
      const o = (j * N + i) * 4
      img.data[o] = Math.round((0.5 + (u * r2 * ax) / 4) * 255)
      img.data[o + 1] = Math.round((0.5 + (v * r2 * ay) / 4) * 255)
      img.data[o + 2] = 128
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

function Barrel({ w, h }: { w: number; h: number }) {
  const aspectKey = Math.round((w / h) * 50)
  const map = useMemo(() => barrelMap(aspectKey / 50), [aspectKey])
  return (
    <svg className="defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="crt-barrel" x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={map} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={2 * BARREL * Math.max(w, h)} xChannelSelector="R" yChannelSelector="G" result="bent" />
        {/* soften the nearest-pixel stair-steps the displacement leaves on straight lines */}
        <feGaussianBlur in="bent" stdDeviation="0.4" />
      </filter>
    </svg>
  )
}

// The bulge moves what you see but not where the browser looks for the pointer, so near the edges
// a press lands a few pixels off the button you aimed at. Every press, hover and cursor on the screen
// goes to whatever is drawn under the pointer instead: the same sum the displacement map does.
const PRESSABLE = 'button, a[href], input, textarea, select, label, summary, [role="tab"], [role="button"]'
const FIELD = 'input, textarea, select'

function useDrawnPointer(inner: React.RefObject<HTMLDivElement | null>, bent: boolean) {
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const drawnAt = (x: number, y: number) => {
      const r = el.getBoundingClientRect()
      if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) return null
      if (!bent) return document.elementFromPoint(x, y)
      const a = r.width / r.height
      const ax = a >= 1 ? 1 : a
      const ay = a >= 1 ? 1 / a : 1
      const k = 2 * BARREL * Math.max(r.width, r.height)
      const u = ((x - r.left) / r.width) * 2 - 1
      const v = ((y - r.top) / r.height) * 2 - 1
      const r2 = u * u + v * v
      const c = (n: number) => Math.max(-0.5, Math.min(0.5, n))
      const sx = Math.max(r.left + 1, Math.min(r.right - 1, x + k * c((u * r2 * ax) / 4)))
      const sy = Math.max(r.top + 1, Math.min(r.bottom - 1, y + k * c((v * r2 * ay) / 4)))
      return document.elementFromPoint(sx, sy)
    }
    const pick = (t: EventTarget | null) => (t instanceof Element ? t.closest(PRESSABLE) : null)

    let hovered: Element | null = null
    const hover = (to: Element | null) => {
      if (to === hovered) return
      hovered?.classList.remove('is-hover')
      hovered = to
      hovered?.classList.add('is-hover')
    }
    let redirect: { to: Element | null } | null = null

    const down = (e: PointerEvent) => {
      redirect = null
      if (!bent || !e.isTrusted || e.button !== 0) return
      const hit = drawnAt(e.clientX, e.clientY)
      if (!hit || !el.contains(hit)) return
      const want = pick(hit)
      if (want === pick(e.target)) return
      // the browser would press the wrong thing: press what is drawn here instead
      e.stopImmediatePropagation()
      e.preventDefault()
      redirect = { to: want }
      hit.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          isPrimary: e.isPrimary,
          button: e.button,
          buttons: e.buttons,
        }),
      )
    }
    const click = (e: MouseEvent) => {
      if (!redirect || !e.isTrusted) return
      const { to } = redirect
      redirect = null
      e.stopImmediatePropagation()
      e.preventDefault()
      if (!to || (to as HTMLButtonElement).disabled) return
      if (to.matches(FIELD)) (to as HTMLElement).focus()
      else (to as HTMLElement).click()
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const hit = drawnAt(e.clientX, e.clientY)
      const want = hit && el.contains(hit) ? pick(hit) : null
      hover(want && !(want as HTMLButtonElement).disabled ? want : null)
      if (bent) el.style.cursor = want ? (want.matches(FIELD) ? 'text' : 'pointer') : hit?.closest('.win-title') ? 'grab' : ''
    }
    const leave = () => hover(null)

    addEventListener('pointerdown', down, true)
    addEventListener('click', click, true)
    addEventListener('pointermove', move, { capture: true, passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      hover(null)
      el.style.cursor = ''
      removeEventListener('pointerdown', down, true)
      removeEventListener('click', click, true)
      removeEventListener('pointermove', move, true)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [inner, bent])
}

type Stage = { img: { x: number; y: number; w: number }; scr: { x: number; y: number; w: number; h: number; r: number } }

// 0: the whole room, 1: the desk (default), 2: closer, 3: the screen fills the window
function stageFor(level: number, W: number, H: number): Stage {
  const fw = ROOM.right - ROOM.left
  const fh = ROOM.bottom - ROOM.top
  const screenAspect = (fw * ROOM.aspect) / fh
  const cover = Math.max(W, H * ROOM.aspect)
  const fit = (w: number, h: number) => Math.min(W * w, H * h * screenAspect)
  // the monitor, from its top edge to the labels under its buttons, fits with this much air above and below
  const keepTop = ROOM.hot.monitor[1]
  const keepBottom = ROOM.hot.power[3] + 0.022
  const air = [0.17, 0.08, 0.04, 0][level]
  const fits = (ROOM.aspect * H * (1 - 2 * air)) / (keepBottom - keepTop)
  let sw = [0, fit(0.5, 0.52), fit(0.62, 0.68), Math.min(W - 24, (H - 24) * screenAspect)][level]
  let wi = level === 0 ? Math.max(cover, fits) : level < 3 ? Math.max(cover, Math.min(sw / fw, fits)) : Math.max(cover, sw / fw)
  sw = fw * wi
  const hi = wi / ROOM.aspect
  const cx = (ROOM.left + ROOM.right) / 2
  const cy = (ROOM.top + ROOM.bottom) / 2
  const x = Math.min(0, Math.max(W - wi, W / 2 - cx * wi))
  let y = level < 3 ? H / 2 - ((keepTop + keepBottom) / 2) * hi : H / 2 - cy * hi
  y = Math.min(0, Math.max(H - hi, y))
  return { img: { x, y, w: wi }, scr: { x: x + ROOM.left * wi, y: y + ROOM.top * hi, w: sw, h: fh * hi, r: ROOM.radius * sw } }
}

const store = {
  get(k: string) {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      /* private mode */
    }
  },
}

// "DISK  : 5 projects found ................ OK": the dots line the OKs up
const boot = (k: string, v: string) => `${k.padEnd(6)}: ${v} `.padEnd(41, '.') + ' OK'

const BOOT = [
  'RL-BIOS v6.0   (c) 2019–2026 Roman Lyubenko',
  '',
  'CPU   : Senior Full Stack Engineer, 7+ years',
  boot('MEM', `${experience.length} jobs since 2021`),
  boot('DISK', `${projects.length} projects found`),
  boot('ROM', '3 game cartridges'),
  boot('NET', 'Kraków, Poland (UTC+1)'),
  '',
  'Loading ROMAN.OS',
]

function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0)
  const [dots, setDots] = useState(0)
  useEffect(() => {
    if (n < BOOT.length) {
      const t = setTimeout(() => setN(n + 1), n === 0 ? 350 : 170)
      return () => clearTimeout(t)
    }
    if (dots < 6) {
      const t = setTimeout(() => setDots(dots + 1), 110)
      return () => clearTimeout(t)
    }
    const t = setTimeout(onDone, 350)
    return () => clearTimeout(t)
  }, [n, dots, onDone])
  useEffect(() => {
    const skip = () => onDone()
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [onDone])
  return (
    <div className="boot" onClick={onDone} role="status" aria-label="Starting up">
      {BOOT.slice(0, n).map((l, i) => (
        <div key={i}>
          {l || ' '}
          {i === BOOT.length - 1 && '.'.repeat(dots)}
        </div>
      ))}
      <span className="cursor" aria-hidden="true" />
      <div className="boot-skip">click or press any key to skip</div>
    </div>
  )
}

function useTyped(text: string, run: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    if (reduceMotion()) {
      setN(text.length)
      return
    }
    if (n >= text.length) return
    const t = setTimeout(() => setN((v) => v + 1), text[n] === ' ' ? 22 : 34)
    return () => clearTimeout(t)
  }, [n, run, text])
  return text.slice(0, n)
}

function Clock() {
  const fmt = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 10_000)
    return () => clearInterval(id)
  }, [])
  return <time className="clock">{t}</time>
}

function Window({
  win,
  active,
  z,
  desk,
  dispatch,
  children,
}: {
  win: Win
  active: boolean
  z: number
  desk: React.RefObject<HTMLDivElement | null>
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>
  children: ReactNode
}) {
  const meta = winMeta(win)
  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (active) ref.current?.focus({ preventScroll: true })
  }, [active])

  const onDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || win.max || isPhone()) return
    const r = desk.current!.getBoundingClientRect()
    drag.current = { px: e.clientX, py: e.clientY, x: win.x, y: win.y, w: r.width, h: r.height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    // the room may be scaled while zoomed: measure in the desktop's own pixels
    const scale = d.w / desk.current!.offsetWidth
    dispatch({ type: 'move', key: win.key, x: d.x + (e.clientX - d.px) / scale / desk.current!.offsetWidth, y: d.y + (e.clientY - d.py) / scale / desk.current!.offsetHeight })
  }
  const onUp = () => (drag.current = null)

  const close = () => {
    sound.close()
    dispatch({ type: 'close', key: win.key })
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={meta.title}
      className={`win${active ? ' is-active' : ''}${win.max ? ' is-max' : ''}`}
      hidden={win.min}
      style={{ left: `${win.x * 100}%`, top: `${win.y * 100}%`, width: `${win.w * 100}%`, height: `${win.h * 100}%`, zIndex: z }}
      onPointerDown={() => !active && dispatch({ type: 'focus', key: win.key })}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <header className="win-title" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => dispatch({ type: 'max', key: win.key })}>
        <PixelIcon name={meta.icon} className="win-icon" />
        <h2>{meta.title}</h2>
        <div className="win-btns">
          <button className="win-btn" aria-label="Minimise" onClick={() => dispatch({ type: 'min', key: win.key })}>
            <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M1 7h8v2H1z" fill="currentColor" />
            </svg>
          </button>
          <button className="win-btn hide-phone" aria-label={win.max ? 'Restore' : 'Maximise'} onClick={() => dispatch({ type: 'max', key: win.key })}>
            <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M1 1h8v8H1zM2 3v5h6V3z" fill="currentColor" fillRule="evenodd" />
            </svg>
          </button>
          <button className="win-btn" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M1 1h2v1h1v1h2V2h1V1h2v2H8v1H7v2h1v1h1v2H7V8H6V7H4v1H3v1H1V7h1V6h1V4H2V3H1z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>
      <nav className="win-path" aria-label="Path">
        <span>Desktop</span>
        {meta.path.map((p, i) => (
          <span key={p}>
            <span className="sep" aria-hidden="true">
              /
            </span>
            {i === meta.path.length - 1 ? <b>{p}</b> : p}
          </span>
        ))}
      </nav>
      <div className="win-body">{children}</div>
      <footer className="win-status">
        <span>{meta.status[0]}</span>
        <span>{meta.status[1]}</span>
      </footer>
    </section>
  )
}

export default function App() {
  const firstVisit = !store.get('ros:booted')
  const [booted, setBooted] = useState(!firstVisit || reduceMotion())
  const [wins, dispatch] = useReducer(reducer, [])
  const [soundOn, setSoundOn] = useState(false)
  const [toast, setToast] = useState('')
  const [level, setLevel] = useState(1)
  const desk = useRef<HTMLDivElement>(null)

  // the monitor's own controls
  const [power, setPower] = useState<Power>('on')
  const [phosphor, setPhosphor] = useState<'amber' | 'green' | 'white'>('amber')
  const [bright, setBright] = useState(2)
  const [contrast, setContrast] = useState(2)
  const [degauss, setDegauss] = useState(false)
  const [lampOn, setLampOn] = useState(true)
  const [osd, setOsd] = useState<{ label: string; level?: number; of?: number; text?: string; key: number } | null>(null)
  const [bubble, setBubble] = useState<{ at: Spot; text: string; key: number } | null>(null)
  useEffect(() => {
    if (!osd) return
    const t = setTimeout(() => setOsd(null), 1700)
    return () => clearTimeout(t)
  }, [osd])
  useEffect(() => {
    if (!bubble) return
    const t = setTimeout(() => setBubble(null), 2600)
    return () => clearTimeout(t)
  }, [bubble])
  const typed = useTyped(profile.tagline, booted)

  const finishBoot = useCallback(() => {
    store.set('ros:booted', '1')
    setBooted(true)
  }, [])

  const open = useCallback((app: AppId, projectId?: string) => {
    sound.open()
    dispatch({ type: 'open', app, projectId })
  }, [])

  const togglePower = () => {
    if (power === 'on') {
      sound.powerOff()
      setPower('turning-off')
      setTimeout(() => setPower('off'), 620)
    } else if (power === 'off') {
      sound.powerOn()
      setPower('turning-on')
      setTimeout(() => setPower('on'), 900)
    }
  }

  const pressButton = (i: number) => {
    if (power !== 'on') return
    sound.button()
    const key = Date.now()
    if (i === 0) {
      const b = (bright + 1) % LEVELS.length
      setBright(b)
      setOsd({ label: 'Brightness', level: b, of: LEVELS.length, key })
    } else if (i === 1) {
      const c = (contrast + 1) % LEVELS.length
      setContrast(c)
      setOsd({ label: 'Contrast', level: c, of: LEVELS.length, key })
    } else if (i === 2) {
      const next = phosphor === 'amber' ? 'green' : phosphor === 'green' ? 'white' : 'amber'
      setPhosphor(next)
      setOsd({ label: 'Phosphor', text: next === 'amber' ? 'P3 amber' : next === 'green' ? 'P1 green' : 'P4 white', key })
    } else {
      sound.degauss()
      setDegauss(false)
      requestAnimationFrame(() => setDegauss(true))
      setTimeout(() => setDegauss(false), 1200)
      setOsd({ label: 'Degauss', text: '...', key })
    }
  }

  const pokeSpot = (s: Spot) => {
    const key = Date.now()
    if (s === 'lamp') {
      sound.button()
      setLampOn((v) => !v)
    } else if (s === 'duck') {
      sound.squeak()
      setBubble({ at: 'duck', text: 'Quack. Now walk me through the bug, line by line.', key })
    } else if (s === 'clock') {
      sound.ring()
      setBubble({ at: 'clock', text: 'Brrring! It’s hire-o’clock.', key })
    } else {
      if (power === 'off') togglePower()
      open('contact')
    }
  }

  // deep links: #projects, #cv, #ukrainian-cars …
  useEffect(() => {
    if (!booted) return
    const h = initialHash
    if (!h) return
    if (APPS.some((a) => a.id === h)) dispatch({ type: 'open', app: h as AppId })
    else if (GAMES.some((g) => g.id === h)) dispatch({ type: 'open', app: 'games', projectId: h })
    else if (projects.some((p) => p.id === h)) {
      if (!isPhone()) dispatch({ type: 'open', app: 'projects' })
      dispatch({ type: 'open', app: 'project', projectId: h })
    }
  }, [booted])

  const top = [...wins].reverse().find((w) => !w.min)
  useEffect(() => {
    if (!booted) return
    const id = top ? (top.app === 'project' ? top.projectId! : top.app) : ''
    const url = id ? `#${id}` : location.pathname + location.search
    if (location.hash.slice(1) !== id) history.replaceState(null, '', url)
  }, [top, booted])

  // lay the photo and the screen out for the window size and zoom level
  const [vp, setVp] = useState(() => ({ W: innerWidth, H: innerHeight, phone: isPhone() }))
  useEffect(() => {
    const onResize = () => setVp({ W: innerWidth, H: innerHeight, phone: isPhone() })
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [])
  const stage = vp.phone ? null : stageFor(level, vp.W, vp.H)

  const screenEl = useRef<HTMLDivElement>(null)
  const [screenSize, setScreenSize] = useState({ w: 0, h: 0 })
  const [barrel] = useState(barrelOk)
  useEffect(() => {
    const el = screenEl.current
    if (!el || !barrel) return
    const ro = new ResizeObserver(([e]) => setScreenSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [barrel])
  const innerEl = useRef<HTMLDivElement>(null)
  const bent = barrel && screenSize.w > 0
  useDrawnPointer(innerEl, bent)

  const toggleSound = () => {
    const on = !soundOn
    sound.set(on)
    setSoundOn(on)
    setToast(on ? 'Sound on. Click the speaker to mute.' : 'Sound off.')
  }
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const [tickerIndex, setTickerIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTickerIndex((i) => (i + 1) % profile.ticker.length), 6000)
    return () => clearInterval(id)
  }, [])

  const body = (w: Win) => {
    switch (w.app) {
      case 'projects':
        return <ProjectsApp onOpen={(id) => open('project', id)} />
      case 'project':
        return <ProjectApp id={w.projectId!} />
      case 'about':
        return <AboutApp />
      case 'experience':
        return <ExperienceApp />
      case 'skills':
        return <SkillsApp />
      case 'posts':
        return <PostsApp />
      case 'terminal':
        return <TerminalApp open={open} close={() => dispatch({ type: 'close', key: w.key })} />
      case 'contact':
        return <ContactApp />
      case 'cv':
        return <CvApp />
      case 'games':
        return <ArcadeApp game={w.projectId as GameId | undefined} active={w === top} />
    }
  }

  return (
    <>
      <div className="room">
        <img
          className="photo"
          src={asset('room/room-2200.webp')}
          srcSet={`${asset('room/room-2200.webp')} 2200w, ${asset('room/room-4400.webp')} 4400w`}
          sizes={stage ? `${Math.round(stage.img.w)}px` : '1px'}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={stage ? { left: stage.img.x, top: stage.img.y, width: stage.img.w } : undefined}
        />
        {stage && (
          <Hardware
            style={{ left: stage.img.x, top: stage.img.y, width: stage.img.w, height: stage.img.w / ROOM.aspect }}
            power={power}
            lampOn={lampOn}
            bubble={bubble}
            onPower={togglePower}
            onButton={pressButton}
            onSpot={pokeSpot}
            asset={asset}
          />
        )}
            <div
              ref={screenEl}
              className={`screen power-${power}${booted ? '' : ' is-booting'}${degauss ? ' is-degauss' : ''}${bent ? ' is-bent' : ''}`}
              data-phosphor={phosphor}
              style={stage ? { left: stage.scr.x, top: stage.scr.y, width: stage.scr.w, height: stage.scr.h, borderRadius: stage.scr.r } : undefined}
            >
              <div
                ref={innerEl}
                className="screen-inner"
                style={{ filter: `${barrel && screenSize.w ? 'url(#crt-barrel) ' : ''}brightness(${LEVELS[bright]}) contrast(${LEVELS[contrast]})` }}
                aria-hidden={power !== 'on'}
              >
                {!booted && <Boot onDone={finishBoot} />}
                <main className="desktop" ref={desk} aria-hidden={!booted} style={booted ? undefined : { visibility: 'hidden' }}>
                  <nav className="icons" aria-label="Desktop">
                    {APPS.map((a) => (
                      <button key={a.id} className="icon" onClick={() => open(a.id)} aria-label={`Open ${a.label}`} aria-expanded={wins.some((w) => w.key === a.id && !w.min)}>
                        <PixelIcon name={a.icon} />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </nav>

                  <div className="hero">
                    <p className="tagline">
                      {typed}
                      <span className="cursor" aria-hidden="true" />
                    </p>
                    <h1 className="name">{profile.name}</h1>
                    <p className="role">
                      {profile.role} · {profile.location}
                    </p>
                  </div>

                  {wins.map((w, i) => (
                    <Window key={w.key} win={w} active={w === top} z={10 + i} desk={desk} dispatch={dispatch}>
                      {body(w)}
                    </Window>
                  ))}
                </main>

                <footer className="taskbar" style={booted ? undefined : { visibility: 'hidden' }}>
                  <div className="quick" aria-label="Quick launch">
                    {APPS.filter((a) => a.id !== 'terminal' && a.id !== 'cv').map((a) => (
                      <button key={a.id} className="quick-btn" aria-label={a.label} title={a.label} onClick={() => open(a.id)}>
                        <PixelIcon name={a.icon} />
                      </button>
                    ))}
                  </div>
                  <div className="tasks">
                    {wins.length ? (
                      [...wins]
                        .sort((a, b) => a.key.localeCompare(b.key))
                        .map((w) => (
                          <button
                            key={w.key}
                            className={`task${w === top ? ' is-active' : ''}`}
                            onClick={() => {
                              sound.click()
                              dispatch(w === top ? { type: 'min', key: w.key } : { type: 'focus', key: w.key })
                            }}
                          >
                            {winMeta(w).title}
                          </button>
                        ))
                    ) : (
                      <p className="ticker" aria-live="polite" key={tickerIndex}>
                        {profile.ticker[tickerIndex]}
                      </p>
                    )}
                  </div>
                  <button className={`quick-btn sound${soundOn ? ' is-on' : ''}`} onClick={toggleSound} aria-label={soundOn ? 'Mute sound' : 'Turn sound on'} aria-pressed={soundOn}>
                    <PixelIcon name={soundOn ? 'speaker' : 'mute'} />
                  </button>
                  <Clock />
                  {toast && (
                    <div className="toast" role="status">
                      {toast}
                    </div>
                  )}
                </footer>
                <Osd osd={osd} />
              </div>
              <div className="degauss-fx" aria-hidden="true" />
              <div className="afterglow" aria-hidden="true" />
              <img className="reflection" src={asset('room/glass.webp')} alt="" aria-hidden="true" draggable={false} />
              <div className="crt" aria-hidden="true">
                <div className="roll" />
              </div>
            </div>
      </div>
      <div className="film" aria-hidden="true" />
      {barrel && screenSize.w > 0 && <Barrel w={screenSize.w} h={screenSize.h} />}
      <div className="zoom" role="group" aria-label="Zoom">
        <button onClick={() => setLevel((l) => Math.min(3, l + 1))} aria-label="Zoom in" title="Zoom in" disabled={level === 3}>
          <PixelIcon name="zoomIn" />
        </button>
        <button onClick={() => setLevel((l) => Math.max(0, l - 1))} aria-label="Zoom out" title="Zoom out" disabled={level === 0}>
          <PixelIcon name="zoomOut" />
        </button>
      </div>
    </>
  )
}

