export default async function handler(req, res) {
  // Diagnostic: show which env vars exist
  const envKeys = Object.keys(process.env).filter(k => 
    k.includes('WORKSPACE') || k.includes('SUPABASE') || k.includes('SSO')
  );
  
  return res.status(200).json({ 
    diagnostic: true,
    matching_env_vars: envKeys,
    WORKSPACE_SSO_URL_set: !!process.env.WORKSPACE_SSO_URL,
    VITE_SUPABASE_URL_set: !!process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
