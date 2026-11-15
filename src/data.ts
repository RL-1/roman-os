// Everything the site says lives here: profile, experience, skills and projects.

export const profile = {
  name: 'Roman Lyubenko',
  role: 'Senior Full Stack Engineer',
  headline: 'Senior Full Stack Engineer (7+ years) | React, TypeScript, Next.js',
  location: 'Kraków, Poland',
  email: 'roman.lyubenko@gmail.com',
  linkedin: 'https://www.linkedin.com/in/roman-lyubenko-8bb4a1234',
  github: 'https://github.com/RL-1',
  cv: 'Roman_Lyubenko_CV.pdf',
  followers: '2,451',
  tagline:
    'Senior full-stack engineer in Kraków, 7+ years in production. React, TypeScript and Next.js up front, Node.js and PostgreSQL behind: CRMs, real-time apps, dashboards, mobile apps and AI products.',
  summary: [
    'Senior full-stack engineer with 7+ years of experience building complex, high-load web applications.',
    'I specialise in React, TypeScript, Next.js and scalable front-end architecture, with Node.js, Prisma and PostgreSQL behind it. I have worked on large CRM systems, real-time apps, dashboards and mobile apps in React Native, and lately on AI products and whole platforms built end to end.',
    'Strong focus on performance, maintainability and clean code. Experience with SSR, WebSockets, WebRTC, CI/CD and cross-team collaboration.',
  ],
  facts: [
    ['Role', 'Senior Full Stack Engineer'],
    ['Uptime', '7+ years in production'],
    ['Front', 'React · Next.js · React Native'],
    ['Back', 'Node.js · Prisma · PostgreSQL'],
    ['Live', 'WebSockets · WebRTC · SignalR'],
    ['Edu', 'SUICT, Kyiv'],
    ['Base', 'Kraków, Poland · remote'],
    ['Lang', 'UA native · RU · EN B1'],
  ] as [string, string][],
  ticker: [
    'Tip: click an icon on the desktop to open it',
    'Now: Senior Full Stack Engineer, remote from Kraków',
    'Shipped: ukrainiancars.com, a dealer platform with auctions, leasing and a 3D test drive',
    'Bored? Games → Snake, Racer and Blocks',
    'Say hi: roman.lyubenko@gmail.com',
  ],
}

export type Job = {
  company: string
  role: string
  type: string
  place: string
  // 'YYYY-MM'; no end means it is the current job
  start: string
  end?: string
  points: string[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ym = (s: string) => s.split('-').map(Number) as [number, number]

// "Sep 2025 – now" and "1 yr 3 mo", counted the way LinkedIn counts them (both months included)
export function period(j: Job) {
  const [sy, sm] = ym(j.start)
  const now = new Date()
  const [ey, em] = j.end ? ym(j.end) : [now.getFullYear(), now.getMonth() + 1]
  const n = (ey - sy) * 12 + (em - sm) + 1
  const y = Math.floor(n / 12)
  const m = n % 12
  return {
    dates: `${MONTHS[sm - 1]} ${sy} – ${j.end ? `${MONTHS[em - 1]} ${ey}` : 'now'}`,
    length: [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(' '),
  }
}

export const experience: Job[] = [
  {
    company: 'NDA',
    role: 'Full Stack Engineer',
    type: 'Full-time',
    place: 'Remote',
    start: '2025-09',
    points: ['Full-stack product work under NDA: React, TypeScript, Node.js. Details on request.'],
  },
  {
    company: 'MATRIX CRM SOFTWARE TRADING L.L.C',
    role: 'Full Stack Engineer',
    type: 'Full-time',
    place: 'Remote',
    start: '2022-07',
    end: '2025-09',
    points: [
      'Led the frontend architecture and development of a large-scale CRM platform used across multiple industries',
      'Built core CRM modules: dashboards, user management, roles & permissions, analytics, and admin tools',
      'Implemented high-performance data tables handling tens of thousands of records (sorting, filtering, pagination, inline editing)',
      'Integrated real-time features: chat, audio calls, and telephony using WebRTC and third-party APIs',
      'Built and maintained a cross-platform mobile app using React Native',
      'Implemented real-time data synchronization via WebSockets and efficient state management',
      'Improved performance through code splitting, lazy loading, and bundle optimization',
      'Conducted code reviews, improved CI/CD pipelines, and promoted best practices in testing and accessibility',
    ],
  },
  {
    company: 'interrio.ai',
    role: 'Frontend Engineer (Contract)',
    type: 'Part-time',
    place: 'Remote',
    start: '2025-02',
    end: '2025-07',
    points: [
      'Developed and maintained responsive landing pages with a strong focus on UX and performance',
      'Built frontend architecture and implemented business logic for dynamic UI components',
      'Integrated REST APIs and managed application state',
      'Performed on-page SEO optimization (semantic HTML, meta tags, loading speed)',
      'Improved navigation structure to increase user engagement and conversions',
      'Optimized performance and ensured cross-browser and cross-device compatibility',
    ],
  },
  {
    company: 'Genesis',
    role: 'Frontend Engineer (Contract)',
    type: 'Part-time',
    place: 'Remote',
    start: '2024-05',
    end: '2025-07',
    points: [
      'Contributed to the development of two full-scale digital products: Interrio and Get-Honey',
      'Built frontend architecture from scratch using React, TypeScript, and modern tooling',
      'Collaborated closely with designers to deliver pixel-perfect, reusable UI components',
      'Introduced modular architecture and shared UI libraries',
      'Improved performance using SSR, code splitting, and lazy loading',
      'Led development of admin panels with complex dashboards, filters, and analytics',
      'Participated in CI/CD workflows, testing, and continuous delivery processes',
    ],
  },
  {
    company: 'Antipoff IT',
    role: 'Frontend Developer',
    type: 'Full-time',
    place: 'Remote',
    start: '2021-11',
    end: '2022-02',
    points: [
      'Worked on a DeFi cryptocurrency platform focused on token farming and staking',
      'Developed UI components and core features using React and TypeScript',
      'Integrated real-time crypto price analytics and market data',
      'Collaborated with backend and blockchain teams to connect smart contracts and APIs',
      'Improved UI responsiveness, code quality, and overall user experience',
    ],
  },
  {
    company: 'TEO CRM',
    role: 'Frontend Developer',
    type: 'Full-time',
    place: '',
    start: '2021-04',
    end: '2021-11',
    points: [
      'Solely developed a full-featured printing services platform from concept to production',
      'Built dynamic order configuration and filtering systems',
      'Implemented interactive maps with real-time pricing and availability',
      'Developed high-performance data tables with sorting, pagination, and search',
      'Built an admin panel for managing products, pricing, and store settings',
      'Ensured responsive design, performance optimization, and clean architecture',
    ],
  },
]

export const education = [
  {
    school: 'State University of Information and Communication Technologies',
    native: 'Державний університет інформаційно-комунікаційних технологій',
    place: 'Kyiv, Ukraine',
  },
]

export type Post = { title: string; summary: string; date: string; reactions: number; views: number }

// LinkedIn posts, written in Ukrainian; newest first
export const posts: Post[] = [
  {
    title: 'React’s use() hook',
    summary: 'Read data that is already resolved right in the component: no hand-made state and effects just to fetch, loading states through Suspense, and better server rendering and streaming in Next.js.',
    date: 'Feb 2026',
    reactions: 78,
    views: 12303,
  },
  {
    title: 'Why forEach and async/await don’t mix',
    summary: 'forEach does not wait for an async callback, so the code after it runs too early. Use for…of to go one at a time, or map with Promise.all to run them in parallel.',
    date: 'Jan 2026',
    reactions: 69,
    views: 9726,
  },
  {
    title: 'Motion-first animated icons',
    summary: 'A neat open-source (MIT) set of animated icons as ready React components, for small micro-interactions without the noise.',
    date: 'Jan 2026',
    reactions: 10,
    views: 879,
  },
  {
    title: '4 advanced JavaScript concepts',
    summary: 'Currying, throttling, lazy evaluation and function comparison: what each one is for and when it pays off.',
    date: 'Jan 2026',
    reactions: 123,
    views: 8313,
  },
  {
    title: 'React or Next.js?',
    summary: 'The wrong question. React suits dynamic SPAs where you want full control; Next.js when SEO, SSR or static generation matter. Next.js is built on React, and strong JavaScript makes moving between them easy.',
    date: 'Jan 2026',
    reactions: 85,
    views: 10739,
  },
  {
    title: 'Documentation AI',
    summary: 'An AI platform that writes and maintains docs and knowledge bases, keeps one style across endpoints and answers questions with links to the sources.',
    date: 'Jan 2026',
    reactions: 27,
    views: 2046,
  },
  {
    title: 'No console.log in production, for free',
    summary: 'In Next.js, turn on compiler.removeConsole and every console.log disappears from the production build, while dev mode keeps them.',
    date: 'Jan 2026',
    reactions: 87,
    views: 18395,
  },
  {
    title: 'Why React keeps asking for keys',
    summary: 'How reconciliation decides what to update, keep or recreate in the DOM, and how keys save you from extra re-renders and lost state.',
    date: 'Jan 2026',
    reactions: 33,
    views: 3055,
  },
  {
    title: 'VS Code is now an “open-source AI editor”',
    summary: 'And AI interaction data may be used to train models unless you switch it off in the settings.',
    date: 'Jan 2026',
    reactions: 33,
    views: 3386,
  },
  {
    title: '8 AI tools for front-end developers',
    summary: 'GitHub Copilot, Locofy.ai, Codeium, Galileo AI, Penpot, TypingMind, Vercel AI SDK and Uizard: what each one takes off your plate.',
    date: 'Jan 2026',
    reactions: 32,
    views: 2002,
  },
]

export const skills: { group: string; items: string[] }[] = [
  { group: 'languages', items: ['TypeScript', 'JavaScript'] },
  { group: 'front-end', items: ['React', 'Next.js', 'SSR / SSG', 'React Native', 'Redux Toolkit', 'RTK Query', 'TanStack Query', 'Zustand', 'React Hook Form', 'Tailwind CSS', 'MUI', 'MUI X Data Grid', 'shadcn/ui'] },
  { group: 'back-end', items: ['Node.js', 'Express', 'Prisma', 'PostgreSQL', 'SQLite', 'REST'] },
  { group: 'real-time', items: ['WebSockets', 'WebRTC', 'SignalR', 'Telephony APIs'] },
  { group: 'bots-and-ai', items: ['Telegram Bot API', 'grammY', 'Telegram Mini Apps', 'OpenAI API', 'Claude API'] },
  { group: '3d-and-motion', items: ['three.js', 'React Three Fiber', 'Remotion', 'MapLibre GL'] },
  { group: 'testing', items: ['Jest', 'React Testing Library', 'Vitest'] },
  { group: 'tools', items: ['Git · Gitflow', 'Conventional Commits', 'GitHub', 'GitLab', 'Vite', 'Storybook', 'Figma', 'Postman', 'Jira', 'Sentry', 'Vercel', 'Docker', 'TeamCity'] },
  { group: 'practice', items: ['Frontend architecture', 'Performance', 'SEO', 'Accessibility', 'CI/CD', 'Responsive design', 'Agile / Scrum', 'Code review', 'Mentoring'] },
  { group: 'spoken', items: ['Ukrainian · native', 'Russian · advanced', 'English · B1'] },
]

export type Category = 'web' | 'ai' | 'studio'

export type Shot = { src: string; alt: string; video?: string; vertical?: boolean }

export type Project = {
  id: string
  name: string
  year: string
  kind: string
  category: Category
  role: string
  pitch: string
  summary: string
  points: string[]
  stack: string[]
  url?: string
  links?: { label: string; href: string }[]
  thumb?: string
  shots?: Shot[]
  glyph?: 'folder' | 'doc' | 'briefcase' | 'chip' | 'terminal' | 'mail' | 'floppy' | 'book' | 'bot' | 'grid'
}

export const projects: Project[] = [
  {
    id: 'voryxen',
    name: 'Voryxen Production',
    year: '2026',
    kind: 'Studio website',
    category: 'studio',
    role: 'Design and development',
    pitch: 'An independent studio for product design, development and AI film.',
    summary:
      'The website of Voryxen Production, a digital and creative studio: services, case studies of mobile and desktop products, AI films, a journal and a shelf of free tools for planning a project, in English, Ukrainian and Russian.',
    points: [
      'Case studies for Orbita CRM, Matrix CRM, Daily Nutrition, Speech Synthesis and more, filtered by mobile and desktop',
      'Free tools: a project cost estimator, a website health check on Google Lighthouse, an automation savings calculator, MVP scope and brief builders, an image optimiser',
      'Three languages, a journal, careers and legal pages, analytics only with consent',
      'Smooth scrolling and three.js visuals in the hero',
      'A 43-second commercial rendered from React components in Remotion',
    ],
    stack: ['React', 'TypeScript', 'Vite', 'three.js', 'Lenis', 'Remotion', 'Cloudflare'],
    url: 'https://voryxenproduction.com',
    links: [{ label: 'Work', href: 'https://voryxenproduction.com/work/' }],
    thumb: 'media/voryxen-site.webp',
    shots: [
      { src: 'media/voryxen-site.webp', alt: 'Voryxen Production home page: “We create digital experiences that connect”' },
      { src: 'media/voryxen-work.webp', alt: 'Selected projects: Orbita CRM and an astrology app' },
      { src: 'media/voryxen-poster.webp', alt: 'The Voryxen commercial, 43 seconds rendered in Remotion', video: 'media/voryxen.mp4' },
    ],
  },
  {
    id: 'ukrainian-cars',
    name: 'Ukrainian Cars',
    year: '2026',
    kind: 'Dealer platform',
    category: 'web',
    role: 'Full-stack developer, solo',
    pitch: 'A car dealer’s whole business on one platform.',
    summary:
      'Website, back office and bots for a Ukrainian car dealership: the catalogue, import from US and European auctions, leasing, and the admin panel the team runs the business from.',
    points: [
      'Catalogue synced from AUTO.RIA, plus live Copart and IAAI auction lots with a turnkey import cost calculator',
      'Leasing calculator comparing bank offers, consignment and buyout quizzes, test-drive booking',
      'Admin panel: chats, leads with reminders, calls, listings, CMS pages, texts, quizzes and forms',
      'Sellers’ cabinet with Telegram-code sign-in and listings moderated right in the bot',
      'three.js car viewer and a drivable 3D test-drive scene built from listing photos',
      'A 41-second vertical ad rendered from code in Remotion',
      'Structured data and video heroes tuned for phones; Lighthouse SEO 100',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Tailwind', 'Express', 'Prisma', 'PostgreSQL', 'three.js', 'Telegram Bot API', 'Remotion', 'Vercel'],
    url: 'https://ukrainiancars.com',
    links: [
      { label: 'Instagram', href: 'https://www.instagram.com/ukrainiancars_ua' },
      { label: 'Telegram', href: 'https://t.me/+-soSdt1KlYczNDk6' },
      { label: 'TikTok', href: 'https://www.tiktok.com/@ukrainiancars1' },
    ],
    thumb: 'media/uc.webp',
    shots: [
      { src: 'media/uc.webp', alt: 'Ukrainian Cars home page with a hero video of a BMW' },
      { src: 'media/uc-3d.webp', alt: 'A Mercedes C 63 built in 3D from photos, with opening doors' },
      { src: 'media/uc-ad-poster.webp', alt: 'The 41-second vertical ad', video: 'media/uc-ad.mp4', vertical: true },
    ],
  },
  {
    id: 'matrixcrm',
    name: 'MatrixCRM',
    year: '2022–2025',
    kind: 'CRM · web and mobile',
    category: 'web',
    role: 'Full Stack Engineer, front-end architecture lead',
    pitch: 'A large CRM for service businesses, on the desk and in the pocket.',
    summary:
      'A CRM platform used across several industries: clients, schedules, procedure records, referrals, analytics, chat and telephony, with a React Native app for the people doing the work. I led its front-end architecture.',
    points: [
      'Core modules: dashboards, user management, roles and permissions, analytics and admin tools',
      'Data tables for tens of thousands of records with sorting, filtering, pagination and inline editing',
      'Chat, audio calls and telephony over WebRTC and third-party APIs',
      'Real-time sync over WebSockets and SignalR',
      'Cross-platform mobile app in React Native: the day’s schedule, treatment records on a face map, referrals and chat',
      'Code splitting, lazy loading and bundle work for speed; code reviews and CI/CD',
    ],
    stack: ['React', 'TypeScript', 'MUI', 'MUI X Data Grid', 'Redux Toolkit', 'Zustand', 'TanStack Query', 'SignalR', 'WebRTC', 'React Native', 'Vite'],
    links: [{ label: 'Case study', href: 'https://voryxenproduction.com/work/matrix-crm/' }],
    thumb: 'media/matrix-2.webp',
    shots: [
      { src: 'media/matrix-2.webp', alt: 'MatrixCRM mobile: the day’s schedule by practitioner' },
      { src: 'media/matrix-1.webp', alt: 'MatrixCRM mobile sign-in' },
      { src: 'media/matrix-3.webp', alt: 'A treatment area marked on a face photo' },
      { src: 'media/matrix-4.webp', alt: 'A conversation inside the app' },
    ],
  },
  {
    id: 'interrio',
    name: 'Interrio',
    year: '2024–2025',
    kind: 'AI interior design',
    category: 'ai',
    role: 'Frontend engineer, contract',
    pitch: 'From a photo of a room to a fully designed space.',
    summary:
      'An AI interior designer: upload a photo of a room, pick a style and get a redesigned space you can keep refining. Change the style, make the whole room over, stage an empty one with furniture, or edit just one area. Built for home owners, estate agents, designers and architects.',
    points: [
      'Front-end architecture from scratch, and the business logic behind dynamic UI components',
      'Responsive landing pages with a strong focus on UX, speed and on-page SEO',
      'REST API integration and application state',
      'Navigation reworked to raise engagement and conversions',
      'Cross-browser and cross-device, with SSR, code splitting and lazy loading',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Redux Toolkit', 'REST API', 'SEO'],
    url: 'https://www.interr.io',
    thumb: 'media/interrio.webp',
    shots: [
      { src: 'media/interrio.webp', alt: 'Interrio home page: AI interior design from a photo' },
      { src: 'media/interrio-2.webp', alt: 'Change Style, Room Makeover and Staging Furniture, before and after' },
    ],
  },
  {
    id: 'get-honey',
    name: 'Get Honey',
    year: '2024–2025',
    kind: 'AI companions',
    category: 'ai',
    role: 'Frontend engineer, contract',
    pitch: 'AI characters you design yourself, to chat with and bring to life.',
    summary:
      'A platform for AI companions: set a character’s appearance, personality and voice, chat with it and generate realistic video, with a catalogue to browse and premium content packs.',
    points: [
      'Front-end architecture from scratch on React and TypeScript',
      'Pixel-perfect reusable UI components, built hand in hand with the designers',
      'Modular architecture and shared UI libraries',
      'Admin panels with complex dashboards, filters and analytics',
      'Code splitting and lazy loading for speed; CI/CD, testing and continuous delivery',
    ],
    stack: ['React', 'TypeScript', 'Vite', 'Redux Toolkit', 'REST API'],
    url: 'https://get-honey.ai',
    thumb: 'media/honey.webp',
    shots: [{ src: 'media/honey.webp', alt: 'Get Honey home page with AI characters' }],
  },
]

export const categories: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Platforms' },
  { id: 'ai', label: 'AI products' },
  { id: 'studio', label: 'Studio' },
]
