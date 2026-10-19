# My Training Lab 0.5.0 — notas de actualización

## Añadido/reforzado
- Alta e inicio de sesión Supabase, perfil por usuario y sincronización privada mediante `user_app_data` con RLS.
- Cuestionario de personalización de hasta 15 preguntas y generación de propuesta semanal mediante IA con plan de reserva local.
- Chat conversacional My Coach con el contexto más reciente de sesiones, notas de recuperación, sueño, fatiga y futuras sesiones. Las propuestas de cambio se validan antes de mostrarse.
- Importación de PDF a través de Netlify Functions + API de Anthropic; crea un programa semanal y/o sesiones con fecha para el calendario, como borrador revisable.
- Edición de registros de recuperación; fecha, valores, notas y captura editables, con recálculo del estado.
- Panel de análisis de sueño/recuperación/fatiga y accesos para consultar al entrenador.
- 16 ilustraciones locales de ejercicios para calendario y sesión activa.
- Se evita mostrar la dieta fija de la ficha de Marc a cuentas nuevas.

## Requisitos de despliegue
- Ejecutar `supabase/schema.sql` en el SQL Editor del proyecto Supabase.
- Configurar en Netlify `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` y, para iOS nativo, `EXPO_PUBLIC_COACH_API_URL`.
- Habilitar sign-up en Supabase Auth Email. No usar la service role key en el frontend.
- Volver a desplegar después de cambiar variables de build.

## Validación
- Se revisó la sintaxis TypeScript/JSX con TypeScript `transpileModule` y la sintaxis JavaScript de la función Netlify.
- No se pudo completar una instalación de dependencias ni una compilación Expo real en este entorno; sigue siendo necesario ejecutar `npm install`, `npm run typecheck` y probar en Netlify/iPhone.
