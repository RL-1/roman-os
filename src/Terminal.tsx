// A small shell: help, whoami, projects, open <name>, skills, contact, cv, clear…
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { experience, period, posts, profile, projects, skills } from './data'
import { sound } from './sound'
import { APPS, type AppId } from './wm'

type Line = { id: number; node: ReactNode }

const COMMANDS = ['help', 'whoami', 'about', 'projects', 'open', 'experience', 'posts', 'skills', 'contact', 'email', 'cv', 'games', 'snake', 'racer', 'blocks', 'ls', 'date', 'clear', 'exit', 'hire']

let seq = 0
const line = (node: ReactNode): Line => ({ id: ++seq, node })

export function TerminalApp({ open, close }: { open: (app: AppId, projectId?: string) => void; close: () => void }) {
  const [lines, setLines] = useState<Line[]>(() => [
    line(<span className="dim">ROMAN.OS shell. Type “help” and press Enter.</span>),
  ])
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIndex, setHIndex] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  const run = (raw: string): ReactNode[] | 'clear' => {
    const [cmd = '', ...rest] = raw.trim().split(/\s+/)
    const arg = rest.join(' ').toLowerCase()
    switch (cmd.toLowerCase()) {
      case '':
        return []
      case 'help':
        return [
          'Commands:',
          '  whoami            who is this',
          '  projects          list projects',
          '  open <name>       open a project or an app (open peacely, open cv)',
          '  experience        where I have worked',
          '  posts             what I write on LinkedIn',
          '  skills            what I work with',
          '  contact | email   how to reach me',
          '  cv                download my CV',
          '  snake | racer | blocks   play a game',
          '  clear             clear the screen',
        ]
      case 'whoami':
      case 'about':
        return [`${profile.name} — ${profile.role}, ${profile.location}.`, profile.tagline]
      case 'ls':
        return [APPS.map((a) => a.id + '/').join('  ')]
      case 'projects':
        return projects.map((p) => `  ${p.id.padEnd(16)} ${p.year.padEnd(9)} ${p.kind}`).concat(['', 'Try: open ' + projects[0].id])
      case 'experience':
        return experience.map((j) => `  ${period(j).dates.padEnd(20)} ${j.company} — ${j.role}`)
      case 'posts':
        return posts.map((p) => `  ${p.date.padEnd(9)} ${p.title}`).concat(['', 'Try: open posts'])
      case 'skills':
        return skills.map((g) => `  ${(g.group + '/').padEnd(15)} ${g.items.join(', ')}`)
      case 'contact':
      case 'email':
        return [
          <>
            email     <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </>,
          <>
            linkedin  <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">{profile.linkedin.replace('https://www.', '')}</a>
          </>,
          <>
            github    <a href={profile.github} target="_blank" rel="noopener noreferrer">{profile.github.replace('https://', '')}</a>
          </>,
        ]
      case 'cv':
        open('cv')
        return ['Opening CV…']
      case 'games':
      case 'snake':
      case 'racer':
      case 'blocks': {
        const g = cmd.toLowerCase() === 'games' ? 'snake' : cmd.toLowerCase()
        open('games', g)
        return [`Inserting the ${g} cartridge…`]
      }
      case 'date':
        return [new Date().toString()]
      case 'clear':
        return 'clear'
      case 'exit':
        close()
        return []
      case 'hire':
      case 'sudo':
        if (cmd === 'sudo' && arg !== 'hire roman' && arg !== 'hire-me' && arg !== 'hire') return [`sudo: ${arg || 'nothing'}: permission denied. Try “sudo hire roman”.`]
        setTimeout(() => (window.location.href = `mailto:${profile.email}?subject=${encodeURIComponent('Let’s work together')}`), 600)
        return ['[sudo] access granted.', 'Opening your mail client…']
      case 'open': {
        if (!arg) return ['usage: open <project|app>']
        const app = APPS.find((a) => a.id === arg || a.label.toLowerCase() === arg)
        if (app) {
          open(app.id)
          return [`Opening ${app.label}…`]
        }
        const p = projects.find((x) => x.id === arg || x.name.toLowerCase() === arg || x.id.startsWith(arg) || x.name.toLowerCase().startsWith(arg))
        if (p) {
          open('project', p.id)
          return [`Opening ${p.name}…`]
        }
        sound.error()
        return [`open: ${arg}: no such project. Type “projects” to list them.`]
      }
      default:
        sound.error()
        return [`${cmd}: command not found. Type “help”.`]
    }
  }

  const submit = () => {
    const out = run(value)
    setHistory((h) => (value.trim() ? [...h, value] : h))
    setHIndex(-1)
    if (out === 'clear') setLines([])
    else
      setLines((ls) => [
        ...ls,
        line(
          <>
            <span className="ps1">roman@os:~$</span> {value}
          </>,
        ),
        ...out.map((n) => line(n)),
      ])
    setValue('')
  }

  return (
    <div className="term" onClick={() => input.current?.focus()}>
      {lines.map((l) => (
        <div key={l.id} className="term-line">
          {l.node}
        </div>
      ))}
      <div className="term-input" ref={end}>
        <label htmlFor="term-in" className="ps1">
          roman@os:~$
        </label>
        <input
          id="term-in"
          ref={input}
          value={value}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Terminal command"
          onChange={(e) => {
            setValue(e.target.value)
            sound.key()
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') submit()
            else if (e.key === 'ArrowUp' && history.length) {
              e.preventDefault()
              const i = hIndex < 0 ? history.length - 1 : Math.max(0, hIndex - 1)
              setHIndex(i)
              setValue(history[i])
            } else if (e.key === 'ArrowDown' && hIndex >= 0) {
              e.preventDefault()
              const i = hIndex + 1
              setHIndex(i >= history.length ? -1 : i)
              setValue(i >= history.length ? '' : history[i])
            } else if (e.key === 'Tab') {
              e.preventDefault()
              const [c, a] = value.split(/\s+/)
              if (a === undefined) {
                const m = COMMANDS.filter((x) => x.startsWith(c))
                if (m.length === 1) setValue(m[0] + ' ')
              } else if (c === 'open') {
                const m = [...APPS.map((x) => x.id as string), ...projects.map((p) => p.id)].filter((x) => x.startsWith(a))
                if (m.length === 1) setValue(`open ${m[0]}`)
              }
            } else if (e.key === 'Escape') close()
          }}
        />
      </div>
    </div>
  )
}
