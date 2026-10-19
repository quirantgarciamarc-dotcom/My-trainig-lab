export type LoadStatus = 'propuesta' | 'declarada' | 'peso_corporal' | 'sin_confirmar';
export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weightKg?: number;
  weightUnit?: string;
  loadStatus: LoadStatus;
  restSeconds: number;
  rir?: number;
  group: string;
  notes?: string;
  imageUrl?: string;
  adjustmentNote?: string;
};
export type DayPlan = {
  day: number; // JS day index: Sun=0 ... Sat=6
  title: string;
  subtitle: string;
  kind: 'strength' | 'endurance' | 'recovery' | 'rest';
  time?: string;
  duration?: string;
  exercises: Exercise[];
  sourceStatus: 'declarado' | 'propuesta' | 'mixto';
  note?: string;
};
const ex = (id: string, name: string, sets: number, reps: string, weightKg: number | undefined, restSeconds: number, group: string, notes?: string, rir?: number, loadStatus: LoadStatus = 'propuesta'): Exercise => ({ id, name, sets, reps, weightKg, restSeconds, group, notes, rir, loadStatus });

export const weeklyPlan: DayPlan[] = [
  {
    day: 0, title: 'Trail running', subtitle: 'Actividad exterior', kind: 'endurance', time: '08:00', duration: '1 h 30 min', exercises: [], sourceStatus: 'declarado',
    note: 'Actividad declarada como parte de tu trabajo deportivo. No se ha facilitado una sesión detallada de ritmos o distancia.'
  },
  {
    day: 1, title: 'Empuje', subtitle: 'Pecho superior · hombros · tríceps', kind: 'strength', time: '16:00', duration: '45–50 min disponibles', sourceStatus: 'mixto',
    note: 'La ficha refleja 16:00–17:00 como horario, pero también indica 45–50 minutos disponibles. Conviene confirmar la duración real.',
    exercises: [
      ex('mon-incline-db', 'Press inclinado con mancuernas', 4, '8–10', 14, 150, 'Pecho superior', 'Propuesta inicial de Claude; no es una carga probada.', 2),
      ex('mon-bench', 'Press de pecho con barra', 3, '10', 40, 120, 'Pecho', 'La ficha también registra 45 kg declarados en press de banca. Confirmar si son kg totales y revisar la diferencia.', 2),
      ex('mon-lateral-db', 'Elevaciones laterales con mancuernas', 3, '15–20', 6, 60, 'Deltoides lateral', 'Carga propuesta, pendiente de validar.', 1),
      ex('mon-crossover', 'Aperturas en polea cruzada', 3, '12–15', 5, 75, 'Pecho', 'Carga propuesta por lado. El plan original sugiere superserie con extensión de tríceps.', 1),
      ex('mon-triceps-overhead', 'Extensión de tríceps por encima de la cabeza en polea', 3, '12–15', 12.5, 75, 'Tríceps', 'Carga propuesta. En el plan original va en superserie con aperturas.', 1)
    ]
  },
  {
    day: 2, title: 'Tirón', subtitle: 'Espalda · bíceps · deltoides posterior', kind: 'strength', time: '16:00', duration: '45–50 min disponibles', sourceStatus: 'propuesta',
    note: 'Alternativa de dominadas: jalón al pecho. Las cargas de este día son propuestas y deben validarse.',
    exercises: [
      ex('tue-pullup', 'Dominadas pronas', 4, '8–10', undefined, 150, 'Espalda', 'Alternativa planificada: jalón al pecho a 50 kg. Elige la variante apropiada.', 2, 'peso_corporal'),
      ex('tue-row-chest', 'Remo con pecho apoyado y mancuernas', 3, '10–12', 14, 120, 'Espalda', 'Carga propuesta por mancuerna.', 2),
      ex('tue-pullover', 'Pullover en polea', 3, '12–15', 20, 90, 'Espalda', 'Carga propuesta.', 1),
      ex('tue-facepull', 'Face pull', 3, '15–20', 12.5, 60, 'Deltoides posterior', 'Carga propuesta.', 2),
      ex('tue-incline-curl', 'Curl inclinado con mancuernas', 3, '10–12', 10, 90, 'Bíceps', 'Carga propuesta por mano.', 1)
    ]
  },
  {
    day: 3, title: 'Descanso activo', subtitle: 'Movilidad · paseo opcional', kind: 'recovery', sourceStatus: 'propuesta', duration: 'Flexible', exercises: [],
    note: 'El descanso activo es una propuesta del plan anterior, no una obligación confirmada. Puedes registrar un paseo o una sesión de movilidad si la realizas.'
  },
  {
    day: 4, title: 'Torso completo', subtitle: 'Fuerza · grosor', kind: 'strength', time: '11:30', duration: '1 h 15 min', sourceStatus: 'mixto',
    note: 'El press militar aparece con 12,5 kg por mano en el documento editado, mientras que la propuesta original era 10 kg. Revisar antes de usar como referencia.',
    exercises: [
      ex('thu-shoulder-press', 'Press militar sentado con mancuernas', 4, '8–10', 12.5, 150, 'Hombros', 'Carga propuesta/editada; pendiente de confirmar frente a la propuesta original de 10 kg por mano.', 2),
      ex('thu-barbell-row', 'Remo con barra inclinado', 4, '8–10', 35, 150, 'Espalda', 'Carga total propuesta.', 2),
      ex('thu-smith-incline', 'Press inclinado en Smith', 3, '10–12', 35, 120, 'Pecho', 'Carga total propuesta.', 2),
      ex('thu-neutral-pulldown', 'Jalón con agarre neutro', 3, '10–12', 45, 120, 'Espalda', 'Carga propuesta.', 2),
      ex('thu-cable-lateral', 'Elevaciones laterales en polea', 3, '15–20', 7.5, 60, 'Deltoides lateral', 'La referencia de 12,5 kg para elevaciones en la ficha es ambigua y no se usa aquí como carga confirmada.', 1),
      ex('thu-dips', 'Fondos en paralelas', 3, '8–12', undefined, 90, 'Pecho · tríceps', 'Utilizar peso corporal; ajustar asistencia si hace falta.', 2, 'peso_corporal'),
      ex('thu-ez-curl', 'Curl con barra Z', 3, '10–12', 20, 90, 'Bíceps', 'Carga total propuesta.', 1)
    ]
  },
  {
    day: 5, title: 'Hombros y brazos', subtitle: 'Detalle estético', kind: 'strength', time: '12:45', duration: '1 h', sourceStatus: 'propuesta',
    note: 'Las cargas son propuestas del documento y no resultados reales registrados.',
    exercises: [
      ex('fri-lateral-db', 'Elevaciones laterales con mancuernas', 3, '15–20', 6, 60, 'Deltoides lateral', 'Carga propuesta por mano.', 1),
      ex('fri-preacher-curl', 'Curl en banco predicador con barra Z', 3, '10–12', 15, 90, 'Bíceps', 'Carga total propuesta; el plan original lo empareja en superserie con press francés.', 1),
      ex('fri-french-press', 'Press francés con barra Z', 3, '10–12', 15, 90, 'Tríceps', 'Carga total propuesta; descanso de 90 s tras el par en la planificación original.', 1),
      ex('fri-hammer-curl', 'Curl martillo con mancuernas', 3, '10–12', 12, 75, 'Bíceps', 'Carga propuesta por mano; superserie propuesta con extensión de tríceps.', 1),
      ex('fri-rope-pushdown', 'Extensión de tríceps en polea con cuerda', 3, '12–15', 20, 75, 'Tríceps', 'Carga propuesta.', 1),
      ex('fri-rear-delt', 'Pájaros para deltoides posterior', 3, '15–20', 4, 60, 'Deltoides posterior', 'Carga propuesta por mano.', 1),
      ex('fri-shrugs', 'Encogimientos de trapecio (opcional)', 3, '10–15', 18, 60, 'Trapecio', 'Carga propuesta por mano.', 2)
    ]
  },
  {
    day: 6, title: 'Ciclismo', subtitle: 'Salida exterior', kind: 'endurance', time: '08:00', duration: 'Aprox. 4 h de pedaleo', exercises: [], sourceStatus: 'declarado',
    note: 'La ficha declara una salida de 08:00 a 14:00 con parada y unas 4 horas de pedaleo. No se han facilitado distancia, desnivel ni zonas de intensidad.'
  }
];

export const nutritionPlan = [
  { day: 1, label: 'Lunes', kcal: 3000, protein: 140, carbs: 440, fat: 75 },
  { day: 2, label: 'Martes', kcal: 3000, protein: 140, carbs: 440, fat: 75 },
  { day: 3, label: 'Miércoles', kcal: 2800, protein: 140, carbs: 380, fat: 80 },
  { day: 4, label: 'Jueves', kcal: 3100, protein: 140, carbs: 465, fat: 75 },
  { day: 5, label: 'Viernes', kcal: 3100, protein: 140, carbs: 465, fat: 75 },
  { day: 6, label: 'Sábado', kcal: 3800, protein: 140, carbs: 620, fat: 85 },
  { day: 0, label: 'Domingo', kcal: 3300, protein: 140, carbs: 505, fat: 80 }
];

export const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const dayShort = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const formatKg = (value?: number) => value === undefined ? 'Peso corporal' : `${Number.isInteger(value) ? value : value.toLocaleString('es-ES')} kg`;
export const formatRest = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
