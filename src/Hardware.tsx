// The physical things in the photo you can poke: the monitor's buttons and power switch,
// the desk lamp, the duck, the alarm clock and the sticky note. Positions come from the render
// (scene/room.py → src/room.json), as fractions of the picture.
import type { CSSProperties } from 'react'
import room from './room.json'

type Rect = number[]
export type Power = 'on' | 'off' | 'turning-off' | 'turning-on'
export type Spot = 'duck' | 'clock' | 'note' | 'lamp'

const box = ([l, t, r, b]: Rect, pad = 0): CSSProperties => ({
  left: `${(l - pad) * 100}%`,
  top: `${(t - pad * room.aspect) * 100}%`,
  width: `${(r - l + 2 * pad) * 100}%`,
  height: `${(b - t + 2 * pad * room.aspect) * 100}%`,
})

export const BUTTONS = ['Brightness', 'Contrast', 'Color', 'Degauss'] as const

export function Hardware({
  style,
  power,
  lampOn,
  bubble,
  onPower,
  onButton,
  onSpot,
  asset,
}: {
  style: CSSProperties
  power: Power
  lampOn: boolean
  bubble: { at: Spot; text: string; key: number } | null
  onPower: () => void
  onButton: (i: number) => void
  onSpot: (s: Spot) => void
  asset: (p: string) => string
}) {
  const lit = power === 'on' || power === 'turning-on'
  const h = room.hot
  return (
    <div className="hardware" style={style}>
      <img
        className={`lamp-off${lampOn ? '' : ' is-shown'}`}
        src={asset('room/lampoff.webp')}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: `${room.lampSplit * 100}%` }}
      />
      <span className={`power-led${lit ? ' is-lit' : ''}`} style={box(h.led, 0.004)} aria-hidden="true" />

      <button className="hot hot-key" style={box(h.power, 0.004)} onClick={onPower} aria-label={lit ? 'Turn the monitor off' : 'Turn the monitor on'} data-tip={lit ? 'Power off' : 'Power on'} />
      {h.buttons.map((r, i) => (
        <button key={BUTTONS[i]} className="hot hot-key hot-round" style={box(r, 0.004)} onClick={() => onButton(i)} aria-label={BUTTONS[i]} data-tip={BUTTONS[i]} disabled={!lit} />
      ))}
      <button className="hot" style={box(h.duck)} onClick={() => onSpot('duck')} aria-label="Rubber duck" data-tip="Rubber duck" />
      <button className="hot" style={box(h.clock)} onClick={() => onSpot('clock')} aria-label="Alarm clock" data-tip="Alarm clock" />
      <button className="hot" style={box(h.note)} onClick={() => onSpot('note')} aria-label="Sticky note: contact me" data-tip="Contact" />
      <button className="hot" style={box(h.lamp)} onClick={() => onSpot('lamp')} aria-label={lampOn ? 'Switch the desk lamp off' : 'Switch the desk lamp on'} data-tip={lampOn ? 'Lamp off' : 'Lamp on'} />

      {bubble && (
        <p key={bubble.key} className={`bubble${(h[bubble.at] as Rect)[1] < 0.18 ? ' is-below' : ''}`} role="status" style={bubbleAt(h[bubble.at] as Rect)}>
          {bubble.text}
        </p>
      )}
    </div>
  )
}

// above the thing, or below it when it sits at the top of the picture
function bubbleAt([l, t, r, b]: Rect): CSSProperties {
  return { left: `${((l + r) / 2) * 100}%`, top: `${(t < 0.18 ? b : t) * 100}%` }
}

export function Osd({ osd }: { osd: { label: string; level?: number; of?: number; text?: string; key: number } | null }) {
  if (!osd) return null
  return (
    <div className="osd" key={osd.key} role="status">
      <span className="osd-label">{osd.label}</span>
      {osd.of ? (
        <span className="osd-bar" aria-label={`${osd.level! + 1} of ${osd.of}`}>
          {Array.from({ length: osd.of }, (_, i) => (
            <i key={i} className={i <= osd.level! ? 'is-on' : ''} />
          ))}
        </span>
      ) : (
        <span className="osd-text">{osd.text}</span>
      )}
    </div>
  )
}
