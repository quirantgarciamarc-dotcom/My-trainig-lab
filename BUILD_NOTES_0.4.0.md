# Notas de versión 0.4.0 — My Training Lab

## Novedades

- Al finalizar una sesión se exige elegir una cara de sensaciones (1–5) y un RPE (1–10); el comentario y las métricas externas son opcionales.
- Las métricas guardadas en el historial incluyen FC media/máxima, distancia, desnivel positivo, velocidad media/máxima, ritmo, calorías, cadencia y potencia.
- El motor local de recuperación considera los registros de Garmin que el usuario introduce manualmente y el esfuerzo/sensaciones de entrenamientos anteriores.
- Las recomendaciones locales pueden reducir cargas/series en fuerza o sugerir una menor duración e intensidad suave para trail/ciclismo cuando hay señales de recuperación baja.
- La IA remota, a través de Netlify Functions y la API de Anthropic, puede proponer cambios en ejercicios de fuerza y en las sesiones de resistencia futuras. La app valida fechas, ejercicios, límites de carga/series, duración e intensidad antes de aplicar cambios.
- Las recomendaciones de IA se revisan manualmente por defecto; el autoajuste es opcional, genera llamadas externas y puede tener coste. La app sigue disponiendo de progresión local sin credenciales.
- La carga propuesta por IA nunca debe cambiar sesiones históricas.

## Límites importantes

- La captura de Garmin se almacena como referencia, pero en esta versión los números no se extraen automáticamente de la imagen: se introducen manualmente.
- No hay conexión automática Garmin Connect ni sincronización en la nube. El almacenamiento es local por dispositivo/navegador.
- El análisis generativo requiere `ANTHROPIC_API_KEY` y `COACH_ACCESS_TOKEN` en Netlify Functions; la clave privada de Anthropic nunca va en el cliente.
- Se verificó la sintaxis de TypeScript/JSX y JavaScript de la función y el formato de los JSON. No se pudo ejecutar una compilación completa de Expo en el entorno que generó el paquete porque no había dependencias instaladas y la instalación de npm había agotado el tiempo de espera.
