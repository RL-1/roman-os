// What each window shows.
import { useState } from 'react'
import { categories, education, experience, period, posts, profile, projects, skills, type Category, type Project } from './data'
import { PixelIcon, type IconName } from './icons'
import { sound } from './sound'
import type { Win } from './wm'
import { APPS } from './wm'

const asset = (p: string) => import.meta.env.BASE_URL + p

export function winMeta(win: Win): { title: string; path: string[]; status: [string, string]; icon: IconName } {
  if (win.app === 'project') {
    const p = projects.find((x) => x.id === win.projectId)!
    return { title: p.name, path: ['Projects', p.name], status: [p.kind, p.year], icon: p.glyph ?? 'folder' }
  }
  const app = APPS.find((a) => a.id === win.app)!
  const status: Record<string, [string, string]> = {
    projects: [`${projects.length} items`, 'Newest first'],
    about: ['about.txt', 'Read-only'],
    experience: [`${experience.length} entries`, 'Since 2021'],
    skills: [`${skills.reduce((n, g) => n + g.items.length, 0)} items in ${skills.length} folders`, ''],
    posts: [`${posts.length} posts`, `${profile.followers} followers`],
    terminal: ['sh', 'roman-os'],
    contact: [profile.location, 'CET, UTC+1'],
    cv: [profile.cv, 'PDF · 1 page'],
    games: ['3 cartridges', 'Arrows · Space · Enter'],
  }
  return { title: app.label, path: [app.label], status: status[app.id], icon: app.icon }
}

export function Placeholder({ p }: { p: Project }) {
  return (
    <span className="ph">
      <PixelIcon name={p.glyph ?? 'folder'} />
      <span className="ph-label">No preview</span>
    </span>
  )
}

export function ProjectsApp({ onOpen }: { onOpen: (id: string) => void }) {
  const [cat, setCat] = useState<Category | 'all'>('all')
  const list = cat === 'all' ? projects : projects.filter((p) => p.category === cat)
  return (
    <div className="projects">
      <div className="tabs" role="tablist" aria-label="Filter projects">
        {categories.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={cat === c.id}
            className="tab"
            onClick={() => {
              sound.click()
              setCat(c.id)
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <ul className="cards">
        {list.map((p) => (
          <li key={p.id}>
            <button className="card" onClick={() => onOpen(p.id)}>
              <span className="card-media">{p.thumb ? <img src={asset(p.thumb)} alt="" loading="lazy" decoding="async" /> : <Placeholder p={p} />}</span>
              <span className="card-name">{p.name}</span>
              <span className="card-meta">
                {p.year} · {p.kind}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProjectApp({ id }: { id: string }) {
  const p = projects.find((x) => x.id === id)!
  const [shot, setShot] = useState(0)
  const cur = p.shots?.[shot]
  return (
    <article className="proj">
      <div className={`proj-media${cur?.vertical ? ' is-vertical' : ''}`}>
        {cur ? (
          <>
            {cur.video ? (
              <video key={cur.video} src={asset(cur.video)} poster={asset(cur.src)} controls playsInline preload="none" />
            ) : (
              <img src={asset(cur.src)} alt={cur.alt} />
            )}
            {p.shots!.length > 1 && (
              <div className="shots" aria-label="Screenshots">
                {p.shots!.map((s, i) => (
                  <button key={s.src} className={`shot${s.video ? ' is-video' : ''}`} aria-pressed={i === shot} aria-label={s.alt} onClick={() => setShot(i)}>
                    <img src={asset(s.src)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Placeholder p={p} />
        )}
      </div>
      <div className="proj-body">
        <p className="proj-pitch">{p.pitch}</p>
        <p>{p.summary}</p>
        <h3 className="h">What I built</h3>
        <ul className="bullets">
          {p.points.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <aside className="proj-facts">
        <dl className="facts">
          <dt>Year</dt>
          <dd>{p.year}</dd>
          <dt>Type</dt>
          <dd>{p.kind}</dd>
          <dt>Role</dt>
          <dd>{p.role}</dd>
        </dl>
        <h3 className="h">Stack</h3>
        <ul className="chips">
          {p.stack.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {p.url && (
          <a className="btn" href={p.url} target="_blank" rel="noopener noreferrer">
            Visit {new URL(p.url).hostname.replace('www.', '')} ↗
          </a>
        )}
        {p.links?.length ? (
          <ul className="proj-links">
            {p.links.map((l) => (
              <li key={l.href}>
                <a className="btn btn-ghost" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>
    </article>
  )
}

const LOGO = String.raw`██████╗ ██╗
██╔══██╗██║
██████╔╝██║
██╔══██╗██║
██║  ██║███████╗
╚═╝  ╚═╝╚══════╝`

export function AboutApp() {
  return (
    <div className="about">
      <div className="neo">
        <pre className="neo-art" aria-hidden="true">
          {LOGO}
        </pre>
        <div className="neo-info">
          <p>
            <b>roman</b>@<b>krakow</b>
          </p>
          <p className="dim" aria-hidden="true">
            ──────────────
          </p>
          {profile.facts.map(([k, v]) => (
            <p key={k}>
              <span className="k">{k}</span> {v}
            </p>
          ))}
          <p className="swatch" aria-hidden="true">
            {[1, 0.8, 0.62, 0.46, 0.32, 0.2].map((o) => (
              <span key={o} style={{ opacity: o }} />
            ))}
          </p>
        </div>
      </div>
      <h2 className="about-h">Hi, I’m Roman.</h2>
      {profile.summary.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  )
}

export function ExperienceApp() {
  return (
    <div className="experience">
      <ol className="timeline">
        {experience.map((j) => {
          const { dates, length } = period(j)
          return (
            <li key={j.company} className={j.end ? '' : 'is-now'}>
              <div className="tl-head">
                <h3>{j.company}</h3>
                <span>
                  {dates} · {length}
                </span>
              </div>
              <p className="tl-role">
                {[j.role, j.type, j.place].filter(Boolean).join(' · ')}
              </p>
              <ul className="bullets">
                {j.points.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
      <h3 className="h">Education</h3>
      {education.map((e) => (
        <div key={e.school} className="edu">
          <b>{e.school}</b>
          <span lang="uk">{e.native}</span>
          <span>{e.place}</span>
        </div>
      ))}
    </div>
  )
}

export function PostsApp() {
  const n = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))
  return (
    <div className="posts">
      <p className="posts-intro">
        I write short notes on React, Next.js and JavaScript for {profile.followers} followers on LinkedIn, in Ukrainian. The latest ones:
      </p>
      <ol className="post-list">
        {posts.map((p) => (
          <li key={p.title}>
            <a href={`${profile.linkedin}/recent-activity/all/`} target="_blank" rel="noopener noreferrer">
              <span className="post-head">
                <b>{p.title}</b>
                <span className="post-date">{p.date}</span>
              </span>
              <span className="post-text">{p.summary}</span>
              <span className="post-stats">
                ♥ {p.reactions} · {n(p.views)} views
              </span>
            </a>
          </li>
        ))}
      </ol>
      <a className="btn" href={`${profile.linkedin}/recent-activity/all/`} target="_blank" rel="noopener noreferrer">
        All posts on LinkedIn ↗
      </a>
    </div>
  )
}

export function SkillsApp() {
  return (
    <div className="skills">
      <p className="prompt" aria-hidden="true">
        C:\ROMAN&gt; tree /skills
      </p>
      <ul className="tree">
        {skills.map((g, i) => (
          <li key={g.group}>
            <span className="tree-dir">
              <span aria-hidden="true">{i === skills.length - 1 ? '└── ' : '├── '}</span>
              {g.group}/
            </span>
            <ul className="chips">
              {g.items.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ContactApp() {
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      sound.click()
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the mailto link still works */
    }
  }
  const mailto = `mailto:${profile.email}?subject=${encodeURIComponent(`Hello from ${name || 'your portfolio'}`)}&body=${encodeURIComponent(msg)}`
  return (
    <div className="contact">
      <p>Email is the quickest way to reach me. LinkedIn works too.</p>
      <ul className="links">
        <li>
          <span className="k">Email</span>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <button className="mini" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </li>
        <li>
          <span className="k">LinkedIn</span>
          <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
            roman-lyubenko ↗
          </a>
        </li>
        <li>
          <span className="k">GitHub</span>
          <a href={profile.github} target="_blank" rel="noopener noreferrer">
            RL-1 ↗
          </a>
        </li>
      </ul>
      <form
        className="compose"
        onSubmit={(e) => {
          e.preventDefault()
          sound.open()
          window.location.href = mailto
        }}
      >
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label>
          Message
          <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />
        </label>
        <button className="btn" type="submit">
          Send via email ↗
        </button>
      </form>
    </div>
  )
}

export function CvApp() {
  return (
    <div className="cv">
      <div className="cv-actions">
        <a className="btn" href={asset(profile.cv)} download>
          Download PDF
        </a>
        <a className="btn btn-ghost" href={asset(profile.cv)} target="_blank" rel="noopener noreferrer">
          Open ↗
        </a>
      </div>
      <div className="paper">
        <h2>{profile.name}</h2>
        <p className="paper-sub">
          {profile.role} · {profile.location} · {profile.email}
        </p>
        <h3 className="h">Summary</h3>
        <p>{profile.summary[0]}</p>
        <h3 className="h">Experience</h3>
        {experience.map((j) => (
          <p key={j.company} className="paper-job">
            <b>{j.company}</b> — {j.role} <span className="dim">{period(j).dates}</span>
          </p>
        ))}
        <h3 className="h">Skills</h3>
        <p>{skills.slice(0, 3).flatMap((g) => g.items).join(' · ')}</p>
      </div>
    </div>
  )
}
