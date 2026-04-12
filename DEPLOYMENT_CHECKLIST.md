# Memorey Deployment Checklist

## Vercel (Web App)

### Environment Variables
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY (sensitive)
- [ ] ANTHROPIC_API_KEY (sensitive)
- [ ] OPENAI_API_KEY (sensitive)
- [ ] NEXT_PUBLIC_APP_URL = https://memorey.co
- [ ] NEXT_PUBLIC_SITE_URL = https://memorey.co
- [ ] NEXT_PUBLIC_MCP_SERVER_URL = [Railway URL]

### Billing (when ready)
- [ ] DODO_SECRET_KEY (sensitive)
- [ ] DODO_WEBHOOK_SECRET (sensitive)
- [ ] DODO_PRO_MONTHLY_PRICE_ID
- [ ] DODO_PRO_YEARLY_PRICE_ID

### Settings
- [ ] Root directory set to `memorey`
- [ ] Build command: `npm run build`
- [ ] Framework: Next.js

## Railway (MCP Server)
- [ ] Root directory set to `mcp-server`
- [ ] SUPABASE_URL
- [ ] SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] OPENAI_API_KEY
- [ ] PORT = 3000
- [ ] Public domain generated

## Supabase
- [ ] All 46 migrations applied
- [ ] search_nodes RPC function exists
- [ ] memorey-exports storage bucket created (private)
- [ ] RLS enabled on all user-data tables
- [ ] OAuth providers configured (if using social login)

## Chrome Extension
- [ ] Extension builds: `cd extension && npm run build`
- [ ] Load as unpacked extension in Chrome from extension/dist/
- [ ] Test: sidebar opens, dashboard loads, all views navigate
- [ ] If sync enabled: verify Supabase connection works

## Domain
- [ ] memorey.co DNS points to Vercel
- [ ] memorey.in DNS points to Vercel (if using)
- [ ] SSL certificates active

## Pre-Launch Verification
- [ ] Web app loads at production URL
- [ ] Sign up / login works
- [ ] Create a memory node works
- [ ] Graph view renders
- [ ] Kanban view works
- [ ] Search returns results
- [ ] Export works
- [ ] MCP server /health returns OK
- [ ] Extension sidebar loads with data
