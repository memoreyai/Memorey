# Memorey MCP Server

Standalone Express server for the Memorey Model Context Protocol. Deploy to Railway (or any Node host).

## Env

Copy `.env.example` to `.env`. Required:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` — optional but recommended for `get_context` when `session_purpose` is set (semantic search)

## Auth

Clients send `Authorization: Bearer <Supabase JWT>`. Use the same access token as the Memorey web app session, or expose a long-lived token from Settings if you add API keys later.

## Scripts

```bash
npm run dev    # tsx watch
npm run build  # tsc → dist/
npm start      # node dist/server.js
```

## Endpoints

- `GET /.well-known/mcp.json` — manifest
- `GET /health` — Railway healthcheck
- `POST /tools/get_context` — Bearer required
- `POST /tools/get_graph_summary` — Bearer required
- `POST /tools/propose_node_update` — Bearer required

Rate limit: 60 requests/minute per bearer token.
