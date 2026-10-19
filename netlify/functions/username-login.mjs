const attempts = new Map();
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
function originAllowed(origin, request) {
  const raw = [process.env.URL, process.env.DEPLOY_PRIME_URL, ...(process.env.COACH_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean), 'http://localhost:19006', 'http://localhost:8081'].filter(Boolean);
  const allowed = new Set(raw.map(value => { try { return new URL(value).origin; } catch { return value; } }));
  if (!origin) return true;
  try { return allowed.has(new URL(origin).origin); } catch { return false; }
}
export default async (request) => {
  const origin = request.headers.get('origin') || '';
  const allowed = originAllowed(origin, request);
  const headers = { 'access-control-allow-methods':'POST, OPTIONS', 'access-control-allow-headers':'content-type', 'vary':'Origin' };
  if (origin && allowed) headers['access-control-allow-origin'] = origin;
  if (!allowed) return json({ error:'Origen no permitido.' },403,headers);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return json({error:'Método no permitido.'},405,headers);
  const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const anon=process.env.SUPABASE_ANON_KEY||'';
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if (!url || !anon || !service) return json({error:'El acceso por nombre de usuario requiere SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY configurados en Netlify Functions.'},503,headers);
  let body;
  try { const raw=await request.text(); if(raw.length>5000) return json({error:'Petición demasiado grande.'},413,headers); body=JSON.parse(raw); } catch { return json({error:'JSON no válido.'},400,headers); }
  const username=String(body?.username||'').trim().toLowerCase();
  const password=String(body?.password||'');
  if (!/^[a-z0-9.-]{3,24}$/.test(username) || password.length<8 || password.length>128) return json({error:'Nombre de usuario o contraseña no válidos.'},400,headers);
  const ip=(request.headers.get('x-nf-client-connection-ip')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,100);
  const now=Date.now();
  const key=`${ip}:${username}`;
  const prior=(attempts.get(key)||[]).filter(t=>now-t<60000);
  if(prior.length>=6) return json({error:'Demasiados intentos. Espera un minuto antes de volver a intentarlo.'},429,headers);
  prior.push(now); attempts.set(key,prior);
  if(attempts.size>3000) for(const [k,vs] of attempts.entries()) if(!vs.some(t=>now-t<60000)) attempts.delete(k);
  try {
    const profileResponse=await fetch(`${url}/rest/v1/profiles?select=user_id&username=ilike.${encodeURIComponent(username)}&limit=1`,{headers:{apikey:service,authorization:`Bearer ${service}`}});
    if(!profileResponse.ok) return json({error:'No se pudo comprobar el usuario. Revisa el esquema de Supabase.'},503,headers);
    const profiles=await profileResponse.json();
    if(!Array.isArray(profiles)||!profiles[0]?.user_id) return json({error:'Nombre de usuario o contraseña incorrectos.'},401,headers);
    const userResponse=await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(profiles[0].user_id)}`,{headers:{apikey:service,authorization:`Bearer ${service}`}});
    if(!userResponse.ok) return json({error:'No se pudo verificar la cuenta.'},503,headers);
    const user=await userResponse.json();
    if(typeof user.email!=='string') return json({error:'Nombre de usuario o contraseña incorrectos.'},401,headers);
    const signIn=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'content-type':'application/json',apikey:anon},body:JSON.stringify({email:user.email,password})});
    const session=await signIn.json().catch(()=>({}));
    if(!signIn.ok || !session.access_token || !session.refresh_token) return json({error:'Nombre de usuario o contraseña incorrectos. Si acabas de registrarte, confirma primero tu correo.'},401,headers);
    // The email is never returned to the caller; only the normal Supabase session is returned.
    return json({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,token_type:session.token_type},200,headers);
  } catch { return json({error:'No se pudo iniciar sesión. Inténtalo de nuevo.'},502,headers); }
};
