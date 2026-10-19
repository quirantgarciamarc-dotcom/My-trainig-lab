# My Training Lab 0.6.1 — Cómo publicarla e instalarla en el móvil

## Dónde publicarla: Netlify (recomendado)
La app ya está preparada para Netlify (`netlify.toml`, funciones del servidor, redirecciones). Es una app web que se instala en la pantalla de inicio: no necesitas App Store ni cuenta de desarrollador.

### Pasos
1. **Supabase** (gratis): crea un proyecto → SQL Editor → pega y ejecuta `supabase/schema.sql`. En Authentication → Providers activa Email. En Authentication → URL Configuration añade la URL de tu sitio de Netlify.
2. **Netlify**: Add new project → importa esta carpeta (o súbela a un repositorio de GitHub y conéctalo). Comando `npx expo export -p web`, carpeta `dist` (ya está en `netlify.toml`).
3. **Variables de entorno en Netlify** (ver `.env.example`):
   - Compilación: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_COACH_API_URL` (= `https://TU-SITIO.netlify.app/.netlify/functions/coach-ai`).
   - Solo servidor: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-5-5`.
4. Vuelve a desplegar para que se apliquen las variables.
5. Comprueba en el sitio: registro, inicio de sesión (email y usuario), dos cuentas sin ver datos mutuos, una sesión completa con descanso, chat del entrenador.

> Importante: en el proyecto de Netlify, desactiva la protección de acceso por SSO/contraseña del sitio de producción, o el móvil pedirá iniciar sesión de Netlify.

## Instalarla en el móvil
- **iPhone (Safari)**: abre la URL → botón Compartir → «Añadir a pantalla de inicio». Debe hacerse desde Safari. Las notificaciones web en iPhone solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4 o superior) y tras aceptar el permiso.
- **Android (Chrome)**: abre la URL → menú ⋮ → «Instalar aplicación» / «Añadir a pantalla de inicio».

## Qué cambió en 0.6.1
- Instalable como app: manifiesto, iconos (incl. maskable y Apple touch), pantalla completa y barra de estado oscura (`src/lib/pwa.ts`, `public/manifest.webmanifest`, `public/icons/`).
- Modelo de IA por defecto corregido a `claude-sonnet-5-5` (antes `claude-sonnet-5`, identificador no válido).
- Cabeceras de caché para el manifiesto e iconos en `netlify.toml`.

## Qué NO se ha podido verificar
No se ha podido ejecutar `npm install`, `typecheck` ni la compilación Expo en el entorno donde se preparó esto (el registro de npm estaba bloqueado). Lo único comprobado: sintaxis de las funciones `.mjs` con `node --check`, e iconos generados. Tampoco se ha probado en un iPhone/Android real, ni las notificaciones, ni Supabase/Anthropic (no hay credenciales). Si la primera compilación en Netlify falla, el registro de la compilación dirá la línea exacta: pásamelo y lo corrijo.
