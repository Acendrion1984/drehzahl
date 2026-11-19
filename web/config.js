// Supabase-Zugangsdaten (Dashboard → Project Settings → API).
// Der "anon public" Key darf öffentlich sein – geschützt sind die Daten durch die Regeln in supabase/schema.sql.
// NIEMALS den "service_role" Key hier eintragen!
window.ZFP_CONFIG = {
  SUPABASE_URL: 'https://DEIN-PROJEKT.supabase.co',
  SUPABASE_ANON_KEY: 'DEIN-ANON-PUBLIC-KEY',
  // Optional: Registrierung nur für diese Mail-Domäne erlauben, z. B. '@schaeffler.com' ('' = alle)
  ERLAUBTE_MAIL_DOMAIN: ''
};
