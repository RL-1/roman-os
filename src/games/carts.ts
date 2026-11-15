// Three cartridges for a handheld brick-game LCD: every game draws on the same 10×20 grid of cells.
// Each one is a small state machine: tick() moves time on, press() takes a button, cells() is the picture.

export const COLS = 10
export const ROWS = 20

export type Pad = 'left' | 'right' | 'up' | 'down' | 'rotate' | 'drop'
export type Fx = 'step' | 'turn' | 'eat' | 'pass' | 'lock' | 'line1' | 'line2' | 'line3' | 'line4' | 'level' | 'crash'

export interface Cart {
  readonly score: number
  readonly level: number
  readonly count: number
  readonly over: boolean
  readonly next?: number[][]
  fx: Fx[]
  speed(): number
  tick(): void
  press(k: Pad): void
  release(k: Pad): void
  cells(): Uint8Array
}

export type GameId = 'snake' | 'racer' | 'blocks'

export const GAMES: { id: GameId; name: string; counter: string; keys: string[]; make: () => Cart }[] = [
  {
    id: 'snake',
    name: 'Snake',
    counter: 'Apples',
    keys: ['←↑→↓  turn', 'Enter  start / pause'],
    make: () => new Snake(),
  },
  {
    id: 'racer',
    name: 'Racer',
    counter: 'Cars',
    keys: ['← →  change lane', '↑  hold to speed up', 'Enter  start / pause'],
    make: () => new Racer(),
  },
  {
    id: 'blocks',
    name: 'Blocks',
    counter: 'Lines',
    keys: ['← →  move   ↓  drop', '↑ or X  rotate', 'Space  slam down', 'Enter  start / pause'],
    make: () => new Blocks(),
  },
]

const grid = () => new Uint8Array(COLS * ROWS)
const put = (g: Uint8Array, x: number, y: number) => {
  if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y * COLS + x] = 1
}
const rand = (n: number) => Math.floor(Math.random() * n)

// ─── Snake ────────────────────────────────────────────────────────────────────

type P = [number, number]
const DIRS: Record<'left' | 'right' | 'up' | 'down', P> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }

class Snake implements Cart {
  body: P[] = [
    [4, 14],
    [4, 15],
    [4, 16],
  ]
  dir: P = [0, -1]
  queue: P[] = []
  food: P = [0, 0]
  score = 0
  level = 1
  count = 0
  over = false
  fx: Fx[] = []
  t = 0

  constructor() {
    this.place()
  }
  place() {
    const free: P[] = []
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!this.body.some(([bx, by]) => bx === x && by === y)) free.push([x, y])
    this.food = free[rand(free.length)]
  }
  speed() {
    return Math.max(80, 250 - (this.level - 1) * 22)
  }
  tick() {
    this.t++
    const d = this.queue.shift()
    if (d) this.dir = d
    const [hx, hy] = this.body[0]
    const head: P = [hx + this.dir[0], hy + this.dir[1]]
    const eats = head[0] === this.food[0] && head[1] === this.food[1]
    // the tail moves out of the way this tick unless the snake grows
    const rest = eats ? this.body : this.body.slice(0, -1)
    if (head[0] < 0 || head[0] >= COLS || head[1] < 0 || head[1] >= ROWS || rest.some(([x, y]) => x === head[0] && y === head[1])) {
      this.over = true
      this.fx.push('crash')
      return
    }
    this.body = [head, ...rest]
    if (eats) {
      this.count++
      this.score += 10 * this.level
      if (this.count % 5 === 0) {
        this.level++
        this.fx.push('level')
      } else this.fx.push('eat')
      if (this.body.length >= COLS * ROWS) {
        this.over = true
        return
      }
      this.place()
    }
  }
  press(k: Pad) {
    if (k === 'rotate' || k === 'drop') return
    const d = DIRS[k]
    const last = this.queue[this.queue.length - 1] ?? this.dir
    if (d[0] === -last[0] && d[1] === -last[1]) return
    if (d[0] === last[0] && d[1] === last[1]) return
    if (this.queue.length < 2) {
      this.queue.push(d)
      this.fx.push('turn')
    }
  }
  release() {}
  cells() {
    const g = grid()
    for (const [x, y] of this.body) put(g, x, y)
    // the apple blinks, like it did on the real thing
    if (this.t % 2 === 0 || this.over) put(g, ...this.food)
    return g
  }
}

// ─── Racer ────────────────────────────────────────────────────────────────────

// the car, top to bottom: a nose, the cabin with its mirrors, the body, two rear wheels
const CAR = ['.#.', '###', '.#.', '#.#']
const LANES = [2, 5]
const CAR_Y = ROWS - 4

class Racer implements Cart {
  lane = 0
  rivals: { lane: number; y: number }[] = []
  road = 0
  score = 0
  level = 1
  count = 0
  over = false
  boost = false
  fx: Fx[] = []

  speed() {
    const base = Math.max(45, 150 - (this.level - 1) * 12)
    return this.boost ? Math.max(30, base * 0.45) : base
  }
  tick() {
    this.road++
    for (const r of this.rivals) r.y++
    const gone = this.rivals.filter((r) => r.y >= ROWS)
    if (gone.length) {
      this.rivals = this.rivals.filter((r) => r.y < ROWS)
      this.count += gone.length
      this.score += gone.length * 10 * this.level
      if (this.count % 10 === 0) {
        this.level++
        this.fx.push('level')
      } else this.fx.push('pass')
    }
    // a new car once the last one is far enough down that there is always time to slip past it
    const last = this.rivals[this.rivals.length - 1]
    const gap = Math.max(10, 13 - Math.floor(this.level / 3))
    if (!last || last.y >= gap - 4 + rand(4)) this.rivals.push({ lane: rand(2), y: -4 })
    this.check()
  }
  check() {
    if (this.rivals.some((r) => r.lane === this.lane && r.y + 4 > CAR_Y && r.y < CAR_Y + 4)) {
      this.over = true
      this.fx.push('crash')
    }
  }
  press(k: Pad) {
    if (k === 'left' && this.lane > 0) this.lane = 0
    else if (k === 'right' && this.lane < 1) this.lane = 1
    else if (k === 'up') {
      this.boost = true
      return
    } else return
    this.fx.push('turn')
    this.check()
  }
  release(k: Pad) {
    if (k === 'up') this.boost = false
  }
  cells() {
    const g = grid()
    // the kerbs scroll past: three lit, one dark
    for (let y = 0; y < ROWS; y++)
      if ((((y - this.road) % 4) + 4) % 4 !== 3) {
        put(g, 0, y)
        put(g, COLS - 1, y)
      }
    const car = (x: number, y: number) => CAR.forEach((row, dy) => [...row].forEach((c, dx) => c === '#' && put(g, x + dx, y + dy)))
    for (const r of this.rivals) car(LANES[r.lane], r.y)
    car(LANES[this.lane], CAR_Y)
    return g
  }
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

const SHAPES = [
  ['....', '####', '....', '....'],
  ['##', '##'],
  ['.#.', '###', '...'],
  ['.##', '##.', '...'],
  ['##.', '.##', '...'],
  ['#..', '###', '...'],
  ['..#', '###', '...'],
].map((rows) => rows.map((r) => [...r].map((c) => (c === '#' ? 1 : 0))))

const turn = (m: number[][]) => m.map((row, y) => row.map((_, x) => m[m.length - 1 - x][y]))

class Blocks implements Cart {
  well: Uint8Array = grid()
  bag: number[] = []
  piece: number[][] = []
  px = 0
  py = 0
  next: number[][]
  score = 0
  level = 1
  count = 0
  over = false
  fx: Fx[] = []
  clearing: number[] = []
  flash = 0

  constructor() {
    this.next = SHAPES[this.draw()]
    this.spawn()
  }
  draw() {
    if (!this.bag.length) this.bag = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5)
    return this.bag.pop()!
  }
  spawn() {
    this.piece = this.next
    this.next = SHAPES[this.draw()]
    this.px = Math.floor((COLS - this.piece.length) / 2)
    this.py = this.piece[0].some(Boolean) ? 0 : -1
    if (this.hits(this.piece, this.px, this.py)) {
      this.over = true
      this.fx.push('crash')
    }
  }
  hits(m: number[][], px: number, py: number) {
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m.length; x++) {
        if (!m[y][x]) continue
        const gx = px + x
        const gy = py + y
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true
        if (gy >= 0 && this.well[gy * COLS + gx]) return true
      }
    return false
  }
  speed() {
    if (this.clearing.length) return 60
    return Math.max(70, 720 - (this.level - 1) * 65)
  }
  tick() {
    if (this.clearing.length) {
      if (++this.flash < 6) return
      for (const y of this.clearing) {
        this.well.copyWithin(COLS, 0, y * COLS)
        this.well.fill(0, 0, COLS)
      }
      this.clearing = []
      this.spawn()
      return
    }
    if (!this.hits(this.piece, this.px, this.py + 1)) this.py++
    else this.lock()
  }
  lock() {
    this.piece.forEach((row, y) => row.forEach((c, x) => c && this.py + y >= 0 && (this.well[(this.py + y) * COLS + this.px + x] = 1)))
    if (this.piece.some((row, y) => row.some(Boolean) && this.py + y < 0)) {
      this.over = true
      this.fx.push('crash')
      return
    }
    const full: number[] = []
    for (let y = 0; y < ROWS; y++) if (this.well.subarray(y * COLS, y * COLS + COLS).every(Boolean)) full.push(y)
    if (!full.length) {
      this.fx.push('lock')
      this.spawn()
      return
    }
    const before = Math.floor(this.count / 10)
    this.count += full.length
    this.score += [0, 100, 300, 700, 1500][full.length] * this.level
    if (Math.floor(this.count / 10) > before) {
      this.level++
      this.fx.push('level')
    } else this.fx.push(`line${full.length}` as Fx)
    this.clearing = full
    this.flash = 0
    this.piece = []
  }
  press(k: Pad) {
    if (this.clearing.length || !this.piece.length) return
    if (k === 'left' || k === 'right') {
      const dx = k === 'left' ? -1 : 1
      if (!this.hits(this.piece, this.px + dx, this.py)) {
        this.px += dx
        this.fx.push('step')
      }
    } else if (k === 'down') {
      if (!this.hits(this.piece, this.px, this.py + 1)) {
        this.py++
        this.score += 1
      } else this.lock()
    } else if (k === 'up' || k === 'rotate') {
      const r = turn(this.piece)
      for (const kick of [0, -1, 1, -2, 2])
        if (!this.hits(r, this.px + kick, this.py)) {
          this.piece = r
          this.px += kick
          this.fx.push('turn')
          break
        }
    } else if (k === 'drop') {
      let n = 0
      while (!this.hits(this.piece, this.px, this.py + 1)) {
        this.py++
        n++
      }
      this.score += 2 * n
      this.lock()
    }
  }
  release() {}
  cells() {
    const g = this.well.slice()
    if (this.clearing.length && this.flash % 2 === 1) for (const y of this.clearing) g.fill(0, y * COLS, y * COLS + COLS)
    this.piece.forEach((row, y) => row.forEach((c, x) => c && put(g, this.px + x, this.py + y)))
    return g
  }
}
