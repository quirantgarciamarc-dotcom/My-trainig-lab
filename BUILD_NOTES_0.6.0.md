# My Training Lab 0.6.0 — notas de actualización

## Mejoras integradas
- Registros de recuperación editables (fecha, sueño, VFC, pulso en reposo, Body Battery, estrés, energía, notas y captura).
- Ilustraciones locales para los ejercicios comunes del plan base; la app evita asignar una imagen de ejercicio incorrecta si no puede reconocer uno importado o creado por IA.
- Chat conversacional My Coach con historial, contexto del perfil, sesiones recientes, sueño, fatiga, RPE y planificación futura. El chat puede devolver propuestas que se validan en la app antes de aplicarse.
- Cuestionario inicial de 15 preguntas o menos; la IA puede crear una propuesta semanal y existe un plan local de reserva.
- Importación de PDF de planificación con extracción de programas semanales y/o sesiones fechadas; los datos importados quedan en el calendario como borrador revisable.
- Alta de perfil con nombre de usuario, correo y contraseña; inicio de sesión con email o username y recuperación de contraseña por correo mediante Supabase Auth.
- Almacenamiento/sincronización individual por cuenta y políticas RLS para impedir acceso a los datos de otros usuarios.
- Análisis local de sueño/recuperación/fatiga y atajos al chat personalizado.
- Cuota de uso de IA persistente por cuenta vía una función SQL de Supabase, con límites de solicitudes de IA y de importación PDF.

## Configuración obligatoria para uso público
1. Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase.
2. Habilitar registros Email en Supabase Auth y configurar URLs autorizadas de Netlify para verificación/recuperación.
3. Variables de build: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_COACH_API_URL`.
4. Variables privadas de Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`; `COACH_ACCESS_TOKEN` solo para el modo local alternativo.
5. Volver a desplegar después de cambiar variables. Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni `ANTHROPIC_API_KEY` al frontend.

## Validación y límites
- Sintaxis TypeScript/JSX revisada con el transpiler de TypeScript; ambas funciones `.mjs` pasan `node --check`; archivos JSON validados.
- La instalación de dependencias no se completó en este entorno, así que no se pudo ejecutar compilación Expo ni pruebas en un iPhone real.
- La importación de PDF depende de Anthropic y debe revisarse antes de aceptar fechas/cargas; no hay lectura OCR automática de capturas Garmin.
- Las ilustraciones son guías visuales y no sustituyen las indicaciones técnicas.
- Garmin Connect sigue sin sincronización automática oficial.
