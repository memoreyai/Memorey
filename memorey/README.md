# Memorey Web App

Full-featured memory management application. View, search, organize, and brief AI tools with your personal knowledge graph.

## Features

- **Graph View** — Interactive canvas with vault-grouped nodes, edges, and minimap
- **Kanban View** — Drag-and-drop board for organizing facts by status, vault, or source
- **Search** — Full-text and semantic search across all memories
- **AI Extraction** — Extract facts from pasted conversations or shared links
- **Briefing** — Generate system prompts or markdown context for any AI tool
- **Export** — JSON, markdown, and portable format export with share links
- **Admin Dashboard** — User management, analytics, revenue tracking

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **Backend:** Supabase (Postgres, Auth, Storage, RLS)
- **AI:** Anthropic Claude SDK, OpenAI SDK
- **State:** Zustand, Immer
- **Visualization:** D3, react-force-graph-2d, Recharts
- **Payments:** Dodo Payments

## Setup

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Supabase

Apply all migrations in `supabase/migrations/` (46 migrations). Ensure the `search_nodes` RPC function exists and the `memorey-exports` storage bucket is created.

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (admin)/admin/      # Admin dashboard (users, analytics, revenue)
│   ├── (dashboard)/        # Main app views (graph, kanban, search, settings)
│   └── api/                # API routes (extract, search, export, ingest, etc.)
├── components/
│   ├── graph/              # Canvas-based graph renderer (nodes, edges, minimap)
│   ├── diff/               # AI extraction diff/approval UI
│   ├── kanban/             # Kanban board components
│   ├── capture/            # Share link ingestion
│   ├── export/             # Export panel and modal
│   └── layout/             # Dashboard shell, sidebar
├── lib/
│   ├── ai/                 # AI extraction and search utilities
│   ├── supabase/           # Supabase client, admin, types, mappers
│   ├── export/             # Export formatting and execution
│   └── vaults/             # Vault resolution and theming
├── store/                  # Zustand stores (graph, vault, diff)
└── types/                  # Shared TypeScript types
```

## Deployment

Deploy on [Vercel](https://vercel.com):

1. Set root directory to `memorey`
2. Framework preset: Next.js
3. Add all environment variables from `.env.local`
4. Deploy

See `DEPLOYMENT_CHECKLIST.md` at the project root for the full checklist.

## Scripts

```bash
npm run dev       # Development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```
