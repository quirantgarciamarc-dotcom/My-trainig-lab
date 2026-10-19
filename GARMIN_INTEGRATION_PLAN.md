# Garmin Connect — alternativa sin autorización de API

## Decisión para esta versión

No se ha implementado integración automática con Garmin Connect. El objetivo es mantener la aplicación de uso personal sin depender de aprobación del Garmin Connect Developer Program, credenciales OAuth ni endpoints no oficiales.

## Flujo de recuperación manual

- Menú → Recuperación.
- El usuario selecciona una captura del resumen de Garmin Connect usando el selector del dispositivo o del navegador.
- La aplicación comprime y guarda localmente la imagen.
- El usuario introduce los valores visibles: horas y puntuación de sueño, VFC/HRV, pulso en reposo, Body Battery, estrés y energía percibida.
- Se guarda un historial con fecha, imagen, métricas y una recomendación explicable.
- Si la lectura más reciente tiene señales de recuperación baja y no supera unos dos días de antigüedad, las siguientes sesiones de fuerza muestran cargas recomendadas reducidas y una serie menos en ejercicios de 3 o más series. Con recuperación moderada, no aumenta la carga y sugiere dejar más repeticiones en reserva.

## Límites

- La captura no se interpreta automáticamente mediante OCR o IA en esta versión. La imagen facilita la consulta, pero los valores se introducen manualmente.
- No se importan automáticamente actividades, GPS, vueltas, ritmos, distancia, potencia, sueño ni métricas fisiológicas desde Garmin.
- No se solicita contraseña de Garmin Connect, no se usa scraping y no se accede a endpoints privados.
- La app no diagnostica ni sustituye la percepción del usuario; ante enfermedad, dolor o síntomas inusuales, no debe confiarse en una puntuación automática.

## Posible ampliación futura

Si se desea OCR o análisis de imágenes automático, habrá que añadir una solución específica y verificar su compatibilidad con web/iOS, privacidad, precisión y costes. Si se quiere sincronización directa, habrá que confirmar primero la elegibilidad del proyecto con Garmin y obtener acceso oficial; esa integración no forma parte de la versión actual.
