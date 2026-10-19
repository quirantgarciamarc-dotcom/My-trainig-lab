# INSTRUCCIÓN PARA NETLIFY AI — ACTUALIZAR MY TRAINING LAB

Trabaja directamente en el proyecto existente de My Training Lab que ya está conectado a este sitio de Netlify. No crees otro sitio ni reescribas la aplicación desde cero. Conserva el perfil/historial actual y los componentes que ya funcionan.

## Cambios requeridos

1. **Perfiles multiusuario seguros.** Usa Supabase Auth y una fila de datos privada por usuario, protegida con Row Level Security. La pantalla de registro debe pedir username, correo y contraseña; el inicio debe aceptar email o username con contraseña. Añade recuperación de contraseña por correo. No guardes contraseñas en AsyncStorage ni expongas claves privadas. Usa `supabase/schema.sql` como fuente de esquema. El endpoint `netlify/functions/username-login.mjs` solo puede usar `SUPABASE_SERVICE_ROLE_KEY` en servidor.

2. **Cuestionario inicial de máximo 15 preguntas.** Tras crear una cuenta sin plan, muestra el cuestionario de perfil, objetivos, experiencia, días, duración, modalidades, equipo, sueño, limitaciones, prioridades, intensidad y otras actividades. Usa Anthropic a través de `netlify/functions/coach-ai.mjs` con `mode: "generate_plan"` para proponer una semana de siete días. Valida las salidas y usa un fallback local si la IA falla. No inventes cargas probadas.

3. **Editar registros de recuperación.** Desde el historial permite editar fecha, sueño, puntuación de sueño, VFC, pulso en reposo, Body Battery, estrés, energía percibida, notas y captura. Al guardar, recalcula la lectura respecto a los registros anteriores a esa fecha. Permite quitar/reemplazar una imagen sin restaurarla accidentalmente.

4. **Imágenes de ejercicios.** Aprovecha las ilustraciones locales de `assets/exercises/` y el mapeo `src/data/exerciseImages.ts` en cada fila y en el ejercicio activo. Si no hay imagen adecuada, muestra un placeholder explícito; no pongas una ilustración de press en un ejercicio que no corresponde. Los ejercicios que se extraigan de PDF deben mapearse por ID o nombre de forma razonable.

5. **Entrenador IA conversacional.** Añade un chat libre que realmente llame a `/.netlify/functions/coach-ai` con `mode: "chat"`. Debe recordar las últimas conversaciones guardadas por la cuenta y recibir solo el contexto relevante: perfil, sesiones recientes, feedback, sueño, recuperación, fatiga, ciclismo/trail y próximas sesiones. El usuario debe poder contar cómo se encuentra sin rellenar un formulario. La respuesta debe dar consejos personalizados, hacer preguntas si faltan datos y distinguir mediciones de hipótesis.

6. **Aplicación controlada de ajustes.** Si la IA propone cambios, devuélvelos como estructura validable y muestra su justificación. Permite aceptarlos/rechazarlos. Solo toca sesiones futuras no realizadas y no alteres el historial. Las cargas no deben subir más de 5% por propuesta de chat, y descansos/series/duración deben validarse contra la planificación base. Conserva el motor local de progreso si Anthropic está desconectado.

7. **Análisis de sueño, recuperación y fatiga.** Combina últimas métricas registradas, variaciones respecto al historial personal, RPE, sensaciones por caras, notas y carga reciente. No diagnostiques. Añade recomendaciones visibles en Inicio/Recuperación y botón para consultar al coach.

8. **Importar PDF al calendario.** Añade selección de un PDF desde Files/Archivos. Envía el archivo a `coach-ai.mjs` con `mode: "import_pdf"` de forma segura y limita su tamaño. La IA debe extraer un programa semanal y/o sesiones fechadas con ejercicios, series, repeticiones, peso, descanso y duración. Valida el JSON y coloca los resultados en `customProgram` y/o `scheduledPlans` por `dateKey`. Si no puede extraer datos, informa del error. Muestra confirmación y recuerda revisar lo importado. La adaptación por recuperación debe aplicarse después, sin sobrescribir sesiones completadas.

9. **Cuotas y claves.** Mantén `ANTHROPIC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` solo en variables privadas de Functions. Usa la RPC `consume_mtl_coach_quota` del SQL para limitar el uso por cuenta; si la cuota persistente falla, no debe quedar el endpoint público sin protección. Usa `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Functions para verificar JWTs.

10. **Compatibilidad y preservación.** Comprueba iPhone/Safari, versión web y navegación existente. No borres datos ni reinicies AsyncStorage; cuando haya un usuario autenticado, guarda la información en una clave local específica y sincronízala con su fila cloud. No muestres los datos predefinidos de un usuario en perfiles nuevos.

## Variables necesarias

Build: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_COACH_API_URL`.

Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`; `COACH_ACCESS_TOKEN` es solo un fallback para el modo local.

## Comprobaciones antes de terminar

- Crear un perfil con username, email y contraseña; cerrar y volver a iniciar con email y con username.
- Verificar que dos cuentas no pueden leer datos mutuamente.
- Completar las preguntas (máximo 15) y ver una planificación personalizada.
- Editar un registro de recuperación, guardar y comprobar que se actualiza en el historial.
- Abrir un ejercicio habitual y comprobar que muestra una ilustración pertinente.
- Conversar con la IA contando fatiga o falta de sueño y ver respuesta contextualizada.
- Solicitar un ajuste y comprobar que solo cambia al aceptarlo.
- Importar un PDF pequeño y verificar que las sesiones aparecen en el calendario sin duplicar ni sobrescribir entrenamientos hechos.
- Verificar errores de API, cuota, variables ausentes y persistencia.

No digas que las pruebas se han superado si no se ejecutaron. Entrega los archivos modificados, enumera las variables que falten y deja el sitio listo para publicar sin inventar credenciales.
