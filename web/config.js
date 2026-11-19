// Supabase-Zugangsdaten (Dashboard → Project Settings → API).
// Der "anon public" Key darf öffentlich sein – geschützt sind die Daten durch die Regeln in supabase/schema.sql.
// NIEMALS den "service_role" Key hier eintragen!
window.ZFP_CONFIG = {
  SUPABASE_URL: 'https://qwznpmuuctmrawnpvxpf.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3em5wbXV1Y3RtcmF3bnB2eHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTQxODMsImV4cCI6MjExMDY3MDE4M30.m1eJTZJIrj0W-CIw4Cj5o3hAxgfD7wwmZeFYywMx0-w',
  // Optional: Registrierung nur für diese Mail-Domäne erlauben, z. B. '@schaeffler.com' ('' = alle)
  ERLAUBTE_MAIL_DOMAIN: ''
};
