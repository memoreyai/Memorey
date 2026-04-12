import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (!body?.nodeId || !body?.text) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: 'missing nodeId or text' }
      )
    }

    const { nodeId, text } = body

    // Authenticate via Bearer token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: 'no auth token' }
      )
    }

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await anonClient.auth.getUser(token)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!(await checkRateLimit(`embed:${user.id}`, 30, 60)).allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Check if OpenAI key is configured
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey || openaiKey === 'your_openai_key' ||
        openaiKey.length < 20) {
      console.warn('[embed] OPENAI_API_KEY not configured — skipping embedding')
      return NextResponse.json({ ok: true, skipped: true,
        reason: 'openai key not configured' })
    }

    // Generate embedding using fetch directly (avoids OpenAI SDK issues)
    const embeddingRes = await fetch(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000),
        }),
      }
    )

    if (!embeddingRes.ok) {
      const errText = await embeddingRes.text()
      console.warn('[embed] OpenAI API error:', embeddingRes.status, errText)
      // Return 200 — embed failure must never block node creation
      return NextResponse.json({ ok: true, skipped: true,
        reason: 'openai api error' })
    }

    const embeddingData = await embeddingRes.json()
    const embedding = embeddingData?.data?.[0]?.embedding

    if (!embedding) {
      console.warn('[embed] No embedding in OpenAI response')
      return NextResponse.json({ ok: true, skipped: true,
        reason: 'no embedding returned' })
    }

    // Save to database using admin client
    const admin = createAdminClient()
    const { error: updateError } = await admin
      .from('memory_nodes')
      .update({ embedding })
      .eq('id', nodeId)
      .eq('user_id', user.id)

    if (updateError) {
      console.warn('[embed] Update error:', updateError)
      return NextResponse.json({ ok: true, skipped: true,
        reason: "Operation failed. Please try again." })
    }

    return NextResponse.json({ ok: true, embedded: true })

  } catch (err) {
    // CRITICAL: always return 200 — embed is non-critical background task
    // A 500 here was blocking node creation in the UI
    console.error('[embed] Unexpected error:', err)
    return NextResponse.json({ ok: true, skipped: true,
      reason: 'unexpected error' })
  }
}
