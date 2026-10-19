# My Training Lab 0.6.0 — Expo, Netlify y Supabase

Aplicación personal de entrenamiento con calendario, rutina guiada, registro de series, imágenes locales de ejercicios, historial, edición de registros de recuperación, análisis de sueño/fatiga, chat conversacional con IA, cuestionario inicial de hasta 15 preguntas e importación de planes en PDF.

## Funciones incluidas en esta actualización

- **Perfiles por usuario:** alta e inicio/cierre de sesión mediante Supabase Auth. El alta solicita nombre de usuario, correo y contraseña; después se puede iniciar sesión con correo o nombre de usuario. El correo se utiliza para verificación y recuperación de cuenta.
- **Cuestionario personalizado:** hasta 15 preguntas. Se crea una propuesta semanal basada en las respuestas y, si la conexión a Anthropic está configurada, se solicita un plan personalizado a la IA. Si la IA no está disponible, se utiliza un plan local de reserva.
- **Datos aislados:** cada cuenta guarda su estado en `public.user_app_data`. Las políticas RLS limitan el acceso a la fila del propio usuario. Los datos de la aplicación no están disponibles para otros usuarios.
- **Chat My Coach:** conversación libre sobre energía, sueño, fatiga, rendimiento y modificaciones. El contexto enviado incluye datos de la cuenta actual, no los de otras cuentas.
- **Recuperación editable:** se pueden editar fecha, métricas, notas y captura; se vuelve a calcular el estado de recuperación con los registros anteriores a esa fecha.
- **Imágenes de ejercicios:** 16 ilustraciones se incluyen en el paquete para que estén disponibles sin conexión. Los ejercicios nuevos generados por IA obtienen una ilustración aproximada según su nombre; las notas del ejercicio siguen siendo la referencia técnica.
- **Importación de PDF:** la función de Netlify envía el documento a Anthropic para extraer programas semanales y/o sesiones fechadas. Los resultados se guardan como borrador del calendario para revisarlos. PDFs escaneados o complejos pueden requerir revisión manual.
- **Análisis de recuperación:** el resumen combina sueño, métricas de Garmin introducidas manualmente, RPE y sensaciones recientes. Es una ayuda deportiva, no un diagnóstico médico.
- **Planificación:** los planes importados o creados desde el cuestionario pueden adaptarse a la recuperación y al historial. No se reescriben entrenamientos ya completados; las propuestas del chat se validan antes de aplicarse.

## Requisitos de configuración antes de hacer público el registro de cuentas

### 1. Crear el proyecto de Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta el archivo `supabase/schema.sql` completo.
3. En **Authentication → Providers → Email**, permite el registro de usuarios. Recomendado: mantener la verificación de correo habilitada para facilitar la recuperación de cuentas.
4. En la configuración de URL de autenticación, añade el dominio de Netlify como URL de redirección si tu flujo de verificación o recuperación de contraseña lo necesita.
5. Copia la URL del proyecto y la clave publicable/anon. **No uses la `service_role` key en la app ni la incluyas en variables `EXPO_PUBLIC_`.**

El alta pide nombre de usuario, correo y contraseña. El correo se utiliza para la autenticación segura y recuperación; el nombre de usuario identifica el perfil. Los usuarios solo pueden consultar y actualizar sus propios registros gracias a RLS.

### 2. Variables de entorno de Netlify

En **Site configuration → Environment variables**, configura:

| Variable | Ámbito | Uso |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Build | Habilita el cliente de autenticación del frontend |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Build | Clave pública/anon de Supabase; la protección real está en RLS |
| `SUPABASE_URL` | Functions | Verifica sesiones JWT que llaman al entrenador IA |
| `SUPABASE_ANON_KEY` | Functions | Verifica la sesión del usuario en Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions, secreto de máximo privilegio | Limita de forma persistente el uso de IA por cuenta; nunca debe ir al frontend |
| `ANTHROPIC_API_KEY` | Functions, secreto | Acceso privado a la API de Anthropic |
| `ANTHROPIC_MODEL` | Functions | Modelo de Anthropic; predeterminado `claude-sonnet-5` |
| `COACH_ACCESS_TOKEN` | Functions, opcional | Token de reserva para modo local/single-user; mínimo 24 caracteres |
| `EXPO_PUBLIC_COACH_API_URL` | Build (necesario en compilación nativa) | URL completa de `/.netlify/functions/coach-ai` |
| `COACH_ALLOWED_ORIGINS` | Functions, opcional | Dominios permitidos separados por comas |

Después de modificar las variables de build, **vuelve a desplegar** para que estén incluidas en la app web. La clave de Anthropic, `SUPABASE_SERVICE_ROLE_KEY` y las variables utilizadas por Functions deben configurarse como variables privadas del servidor. La cuota persistente limita la IA general a 24 peticiones por minuto y la importación PDF a 3 por hora y usuario. El endpoint de inicio de sesión por nombre de usuario tiene además un límite de intentos por minuto, útil como protección básica; no sustituye controles de abuso avanzados.

En el dominio de Netlify, el registro público solo funcionará después de habilitar Supabase y desplegar con esas variables. Si no se configuran, la app permanece en modo local y no ofrece cuentas multiusuario.

### 3. Chat IA y análisis

Las funciones `netlify/functions/coach-ai.mjs` y `netlify/functions/username-login.mjs` admiten:

- `username-login.mjs`: autenticación por nombre de usuario y contraseña sin revelar al cliente el correo de la cuenta. Requiere `SUPABASE_SERVICE_ROLE_KEY` solo en Netlify Functions.
- `mode: "chat"`: conversación con contexto de perfil, sesiones, recuperación y planificación próxima.
- `mode: "generate_plan"`: propuesta semanal a partir del cuestionario.
- `mode: "import_pdf"`: extracción de programas y sesiones desde PDF.
- Petición de análisis (`mode` omitido): informe y propuestas de ajuste estructurado.

Si el chat genera cambios, se muestran como propuestas pendientes. Antes de aplicarlas, la app valida IDs/fechas permitidas y límites de carga, series, descansos e intensidad.

**Coste y privacidad:** el chat, el cuestionario con generación IA y el PDF se envían a la API de Anthropic a través de Netlify Functions. Solo envía documentos y notas que quieras procesar; el proveedor puede aplicar sus propias condiciones de tratamiento y facturación API. La función no debe devolver ni registrar claves secretas.

## Cómo desplegar en el proyecto que ya tienes

1. Integra el contenido de esta carpeta en el repositorio existente, sin borrar archivos personales ni modificar los secretos. Si Netlify AI ya trabaja sobre el proyecto desplegado, puedes usar `NETLIFY_UPDATE_PROMPT_0.6.0.md` como instrucción de implementación.
2. Añade y confirma los archivos nuevos de `assets/exercises/`, `src/lib/supabase.ts`, `src/data/exerciseImages.ts`, `supabase/schema.sql` y `netlify/functions/coach-ai.mjs`.
3. Configura las variables de entorno indicadas y ejecuta el SQL de Supabase.
4. Netlify debe utilizar `npx expo export -p web` como comando de build y `dist` como directorio publicado; `netlify.toml` conserva esta configuración.
5. Despliega y prueba crear una cuenta nueva, confirmar el correo (si está activado), completar el cuestionario y cerrar/reabrir sesión.
6. Prueba el chat IA, la edición de recuperación, y la importación con un PDF pequeño y legible antes de confiar en calendarios importados.

## Probar localmente

```bash
npm install
npx expo install --fix
npm run typecheck
npm run web
```

Para ejecutar el servidor local con Functions, usa Netlify CLI (`netlify dev`) con las variables de entorno disponibles en tu entorno seguro. No compartas las claves en capturas ni las pegues en el chat.

## Límites conocidos

- Garmin Connect aún no está conectado automáticamente. Puedes cargar métricas manuales/capturas y adjuntar un PDF de entrenamiento. La importación del PDF utiliza IA y puede cometer errores; revisa fechas, pesos, ejercicios y descansos antes de aceptar el plan.
- Las imágenes de ejercicios son ilustraciones guía, no animaciones biomecánicas ni una validación individual de técnica.
- La app analiza tendencias registradas; no lee por sí sola texto de capturas de Garmin.
- No se ha publicado una app nativa `.ipa` ni se ha sometido a la App Store; el proyecto sigue siendo Expo y web/PWA.
- El contenido y las recomendaciones dependen de las métricas realmente guardadas y de la configuración de Anthropic. Los consejos no sustituyen a una valoración médica.
