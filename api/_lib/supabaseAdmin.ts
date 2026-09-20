import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Server-only Supabase client using the service role key, which bypasses
 * Row Level Security entirely -- never expose this key to the browser (no
 * VITE_ prefix, ever). Used exclusively for api/_lib/aiRecipeStore.ts's
 * reads/writes to `ai_recipes`, a table with RLS enabled and zero policies
 * (see its migration), so this is the only way anything can access it.
 * `null` when SUPABASE_SERVICE_ROLE_KEY isn't configured, so AI-mode
 * endpoints can fail with a clear "not configured" error instead of a
 * confusing crash, the same pattern as a missing OPENAI_API_KEY elsewhere.
 *
 * The `realtime.transport: ws` option is required on Node 20 (the Vercel
 * function runtime) even though this app never uses Realtime -- confirmed
 * live that createClient() throws immediately at construction ("Node.js 20
 * detected without native WebSocket support") without it, since it sets up
 * a Realtime client unconditionally. Node 22+ has a native WebSocket and
 * wouldn't need this, but the runtime here is 20.
 */
// @types/ws's constructor signature doesn't structurally match supabase-js's
// WebSocketLikeConstructor (a known mismatch between the two packages'
// published types, not a real runtime incompatibility) -- `as never` is the
// standard minimal escape hatch for this, rather than importing the type
// from @supabase/realtime-js (a transitive, unlisted dependency).
const wsTransport = ws as never

export const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: wsTransport } })
    : null
