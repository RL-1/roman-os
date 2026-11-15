// Window manager: which windows are open, where, and in what stacking order (last = on top).
import type { IconName } from './icons'

export type AppId = 'projects' | 'about' | 'experience' | 'skills' | 'posts' | 'terminal' | 'contact' | 'cv' | 'games' | 'project'

export const APPS: { id: Exclude<AppId, 'project'>; label: string; icon: IconName }[] = [
  { id: 'projects', label: 'Projects', icon: 'folder' },
  { id: 'about', label: 'About me', icon: 'doc' },
  { id: 'experience', label: 'Experience', icon: 'briefcase' },
  { id: 'skills', label: 'Skills', icon: 'chip' },
  { id: 'posts', label: 'Posts', icon: 'book' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'contact', label: 'Contact', icon: 'mail' },
  { id: 'cv', label: 'CV', icon: 'floppy' },
  { id: 'games', label: 'Games', icon: 'gamepad' },
]

export type Win = {
  key: string
  app: AppId
  // the project shown, or the cartridge in the games window
  projectId?: string
  // position and size as fractions of the desktop, so windows follow any screen size
  x: number
  y: number
  w: number
  h: number
  max: boolean
  min: boolean
}

export type Action =
  | { type: 'open'; app: AppId; projectId?: string }
  | { type: 'close'; key: string }
  | { type: 'focus'; key: string }
  | { type: 'move'; key: string; x: number; y: number }
  | { type: 'max'; key: string }
  | { type: 'min'; key: string }

const SIZE: Record<AppId, [number, number]> = {
  projects: [0.72, 0.88],
  project: [0.76, 0.9],
  about: [0.62, 0.84],
  experience: [0.66, 0.86],
  skills: [0.66, 0.84],
  posts: [0.64, 0.86],
  terminal: [0.66, 0.74],
  contact: [0.54, 0.8],
  cv: [0.6, 0.88],
  games: [0.7, 0.94],
}

export const keyOf = (app: AppId, projectId?: string) => (app === 'project' ? `project:${projectId}` : app)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function reducer(wins: Win[], a: Action): Win[] {
  switch (a.type) {
    case 'open': {
      const key = keyOf(a.app, a.projectId)
      const found = wins.find((w) => w.key === key)
      if (found) return [...wins.filter((w) => w.key !== key), { ...found, min: false, projectId: a.projectId ?? found.projectId }]
      const [w, h] = SIZE[a.app]
      const n = wins.filter((w) => !w.min).length
      const x = clamp(0.25 + n * 0.028, 0.02, 0.99 - w)
      const y = clamp(0.04 + n * 0.035, 0.02, 0.99 - h)
      // the games want every pixel of the screen they can get
      return [...wins, { key, app: a.app, projectId: a.projectId, x, y, w, h, max: a.app === 'games', min: false }]
    }
    case 'close':
      return wins.filter((w) => w.key !== a.key)
    case 'focus': {
      const found = wins.find((w) => w.key === a.key)
      if (!found) return wins
      if (wins[wins.length - 1] === found && !found.min) return wins
      return [...wins.filter((w) => w.key !== a.key), { ...found, min: false }]
    }
    case 'move':
      return wins.map((w) => (w.key === a.key ? { ...w, x: clamp(a.x, 0.06 - w.w, 0.94), y: clamp(a.y, 0, 0.94) } : w))
    case 'max':
      return wins.map((w) => (w.key === a.key ? { ...w, max: !w.max } : w))
    case 'min': {
      const found = wins.find((w) => w.key === a.key)
      if (!found) return wins
      // a minimised window drops to the bottom of the stack so the next one gets focus
      return [{ ...found, min: true }, ...wins.filter((w) => w.key !== a.key)]
    }
  }
}
