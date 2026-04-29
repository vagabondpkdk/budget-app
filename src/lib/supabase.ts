// ── Demo mode: Supabase disabled ─────────────────────────────────────────────
// This is a demo build. All data is stored locally (localStorage only).
// No cloud sync, no shared database.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://demo.supabase.co';
const SUPABASE_KEY = 'demo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
