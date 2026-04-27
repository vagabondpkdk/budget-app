import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wkrncpfytewxtnkselae.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrcm5jcGZ5dGV3eHRua3NlbGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDI5NTgsImV4cCI6MjA5Mjg3ODk1OH0.XMVS-La2PwFDumuUnWogG6pjEPv4YOIMr1JcSQIVgjU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
