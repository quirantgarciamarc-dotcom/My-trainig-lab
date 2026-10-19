# MY TRAINING LAB — PAQUETE UNIFICADO

Versión del paquete: 0.6.0  
Plataforma: Expo / React Native, versión web para Netlify y base preparada para iOS.

## Qué contiene

Este archivo reúne el código de la aplicación, funciones de Netlify, ilustraciones de ejercicios, esquema de Supabase, configuración de ejemplo y documentación.

Funciones contempladas en el proyecto:
- Inicio, calendario, plan y ejecución de sesiones con registro de series, cargas, repeticiones y descansos.
- Finalización/abandono de sesiones, historial y eliminación de sesiones realizadas.
- Perfil, objetivos, estadísticas y registro de progreso.
- Valoración al finalizar la sesión mediante caras, RPE y comentario.
- Registro y edición de recuperación, sueño y métricas disponibles de Garmin introducidas por el usuario.
- Motor local de recomendaciones y progresión para entrenamientos futuros.
- Integración opcional con Claude a través de una función privada de Netlify.
- Biblioteca de ilustraciones locales de ejercicios.
- Base de autenticación multiusuario mediante Supabase, cuestionario inicial de hasta 15 preguntas, chat del entrenador y flujo de importación de planes PDF.
- Esquema SQL y funciones de servidor para las características conectadas.

**Importante:** el paquete de código no equivale a un servicio ya desplegado ni garantiza que todos los servicios externos estén configurados. Para habilitar cuentas multiusuario, chat de Claude y sincronización, configura Supabase y las variables privadas de Netlify, y prueba el despliegue. La conexión automática con Garmin Connect no está incluida; los datos Garmin se pueden registrar/importar manualmente.

## Publicar en Netlify

1. Descomprime el ZIP y usa la carpeta `my_training_lab_ios` como raíz del proyecto.
2. Configura el comando de compilación `npx expo export -p web` y la carpeta publicada `dist` (ya indicados en `netlify.toml`).
3. Configura las variables de compilación en Netlify:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_COACH_API_URL`
4. Configura las variables privadas de Functions en Netlify:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)
   - `ANTHROPIC_API_KEY` (solo servidor)
   - `ANTHROPIC_MODEL` (comprueba el identificador disponible en tu cuenta/documentación de Anthropic)
   - `COACH_ACCESS_TOKEN` solo si la configuración elegida lo requiere como fallback
5. En un proyecto Supabase, revisa y ejecuta `supabase/schema.sql`. Verifica las políticas RLS antes de permitir registros públicos.
6. Despliega de nuevo el sitio para que se apliquen las variables de entorno.
7. Prueba registro e inicio de sesión, separación de datos entre dos cuentas, cuestionario, chat, recuperación editable e importación PDF antes de usarlo con datos reales.

No introduzcas `SUPABASE_SERVICE_ROLE_KEY` ni `ANTHROPIC_API_KEY` en variables `EXPO_PUBLIC_*`, archivos del frontend ni repositorios públicos.

## Desarrollo local

Requiere una versión compatible de Node.js y conexión para instalar dependencias:

```bash
npm install
npm run typecheck
npm run build:web
```

Para desarrollo web: `npm run web`.

La distribución nativa para iPhone/TestFlight/App Store requiere un build iOS separado; publicar en Netlify ofrece la versión web que puede abrirse en Safari y añadirse a la pantalla de inicio.

## Verificación y límites conocidos

La estructura y los archivos del paquete se han revisado, pero no se ha completado una instalación limpia de dependencias ni una compilación real en este entorno. Antes de considerarlo producción, ejecuta los comandos anteriores y prueba los flujos en el despliegue de Netlify y Safari en iPhone.

- No hay integración automática con Garmin Connect ni lectura OCR garantizada de capturas.
- El análisis con Claude requiere una clave API de Anthropic y puede generar costes.
- El registro multiusuario requiere configurar Supabase, su autenticación y políticas RLS correctamente.
- No declares una función como operativa hasta probarla en el despliegue real.

## Archivos clave

- `App.tsx`: interfaz y flujo principal.
- `netlify/functions/coach-ai.mjs`: endpoint del entrenador IA.
- `netlify/functions/username-login.mjs`: soporte de inicio de sesión por nombre de usuario.
- `supabase/schema.sql`: esquema de datos y políticas de base de datos.
- `.env.example`: nombres de variables de ejemplo, sin secretos reales.
- `NETLIFY_UPDATE_PROMPT_0.6.0.md`: instrucciones para que la IA de Netlify revise/aplique los cambios en el proyecto conectado.
- `BUILD_NOTES_0.6.0.md`: notas de la versión.
