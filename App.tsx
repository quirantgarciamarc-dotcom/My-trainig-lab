import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, supabaseConfigured } from './src/lib/supabase';
import { setupPwaHead } from './src/lib/pwa';
import { exerciseImageSource } from './src/data/exerciseImages';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { DayPlan, Exercise, dayNames, dayShort, formatKg, formatRest, nutritionPlan, weeklyPlan } from './src/data/plan';

setupPwaHead();

const STORAGE_KEY = '@my_training_lab_v1';
const C = {
  bg: '#080B10', surface: '#111720', surface2: '#18212D', border: '#263241',
  text: '#F2F5F8', muted: '#9BA8B7', accent: '#C8FF42', accent2: '#96C52A',
  warning: '#FFC56B', red: '#FF7878', blue: '#8FB9FF', green: '#8BEEB5',
};

type SetLog = { id: string; exerciseId: string; exerciseName: string; setNumber: number; weightKg?: number; reps: number; rir?: number; createdAt: string; plannedWeightKg?: number; };
type ActiveSession = { id: string; day: number; dateKey: string; startedAt: string; exerciseIndex: number; sets: Record<string, SetLog[]>; restEndsAt?: number; restNotificationId?: string; activityNote?: string; };
type SessionMetrics = { avgHrBpm?: number; maxHrBpm?: number; distanceKm?: number; elevationGainM?: number; avgSpeedKmh?: number; maxSpeedKmh?: number; paceMinPerKm?: number; caloriesKcal?: number; avgCadenceRpm?: number; avgPowerW?: number; };
type SessionFeedback = { mood: number; rpe: number; note?: string; metrics: SessionMetrics; };
type CompletedSession = { id: string; day: number; dateKey: string; title: string; startedAt: string; endedAt: string; sets: SetLog[]; durationSeconds: number; note?: string; status?: 'completed' | 'abandoned'; feedback?: SessionFeedback; };
type CoachAdjustment = { dateKey: string; exerciseId: string; weightKg?: number; sets?: number; reps?: string; restSeconds?: number; sessionDurationMinutes?: number; sessionIntensity?: 'easy' | 'moderate'; reason: string; updatedAt?: string; };
type ReviewDraft = { mood: number | null; rpe: string; note: string; avgHrBpm: string; maxHrBpm: string; distanceKm: string; elevationGainM: string; avgSpeedKmh: string; maxSpeedKmh: string; paceMinPerKm: string; caloriesKcal: string; avgCadenceRpm: string; avgPowerW: string; };
type MetricDraftKey = Exclude<keyof ReviewDraft, 'mood' | 'rpe' | 'note'>;
type CoachRunOptions = { automatic?: boolean; forceAutoApply?: boolean; extraSession?: CompletedSession; extraRecovery?: RecoveryEntry; };
const MOOD_OPTIONS = [{ value: 1, emoji: '😫', label: 'Muy mal' }, { value: 2, emoji: '🙁', label: 'Mal' }, { value: 3, emoji: '😐', label: 'Normal' }, { value: 4, emoji: '🙂', label: 'Bien' }, { value: 5, emoji: '😄', label: 'Muy bien' }];
const EMPTY_REVIEW_DRAFT: ReviewDraft = { mood: null, rpe: '', note: '', avgHrBpm: '', maxHrBpm: '', distanceKm: '', elevationGainM: '', avgSpeedKmh: '', maxSpeedKmh: '', paceMinPerKm: '', caloriesKcal: '', avgCadenceRpm: '', avgPowerW: '' };
type Profile = { name: string; age: string; heightCm: string; currentWeightKg: string; goalWeightKg: string; goalFatPercent: string; notes: string; };
type BodyMeasurement = { id: string; dateKey: string; weightKg: number; bodyFatPercent?: number; waistCm?: number; armCm?: number; chestCm?: number; fatFreeKg?: number; muscleKg?: number; bmrKcal?: number; source: 'bascula' | 'usuario'; };
type MeasurementDraft = { weightKg: string; bodyFatPercent: string; waistCm: string; armCm: string; chestCm: string; };
type Readiness = 'sin-datos' | 'buena' | 'moderada' | 'baja';
type RecoveryEntry = { id: string; dateKey: string; createdAt: string; sleepHours?: number; sleepScore?: number; hrvMs?: number; restingHrBpm?: number; bodyBattery?: number; stressScore?: number; energyScore?: number; notes?: string; imageDataUri?: string; readiness: Readiness; recommendation: string; };
type RecoveryDraft = { dateKey: string; sleepHours: string; sleepScore: string; hrvMs: string; restingHrBpm: string; bodyBattery: string; stressScore: string; energyScore: string; notes: string; };
type OnboardingAnswers = { age: string; heightCm: string; currentWeightKg: string; primaryGoal: string; experience: string; trainingDays: string; sessionMinutes: string; trainingTypes: string; equipment: string; sleepHours: string; limitations: string; priority: string; intensity: string; otherSports: string; target: string; };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; };
type ImportedSessionPlan = { dateKey?: string; plan: DayPlan; };
type OnboardingState = { completed: boolean; answers?: OnboardingAnswers; completedAt?: string; };
type AuthLikeUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
type AuthMode = 'login' | 'signup';
const EMPTY_ONBOARDING: OnboardingAnswers = { age:'', heightCm:'', currentWeightKg:'', primaryGoal:'Hipertrofia', experience:'Intermedio', trainingDays:'Lunes, martes, jueves y viernes', sessionMinutes:'60', trainingTypes:'Gimnasio + ciclismo + trail', equipment:'Gimnasio completo', sleepHours:'7-8', limitations:'Ninguna conocida', priority:'Tren superior', intensity:'Moderada', otherSports:'', target:'Mejorar fuerza y masa muscular de forma sostenible' };
const ONBOARDING_QUESTIONS: Array<{ key: keyof OnboardingAnswers; title: string; help: string; type: 'text'|'number'|'choice'; options?: string[] }> = [
  {key:'age', title:'¿Qué edad tienes?', help:'Solo se utilizará para contextualizar la planificación.', type:'number'},
  {key:'heightCm', title:'¿Cuál es tu altura en centímetros?', help:'Puedes dejarlo vacío si prefieres no indicarlo.', type:'number'},
  {key:'currentWeightKg', title:'¿Cuál es tu peso actual en kg?', help:'Utiliza tu medición más reciente.', type:'number'},
  {key:'primaryGoal', title:'¿Cuál es tu objetivo principal?', help:'Podrás cambiarlo desde tu perfil.', type:'choice', options:['Hipertrofia','Fuerza','Rendimiento de resistencia','Salud y condición física','Recomposición corporal']},
  {key:'experience', title:'¿Qué experiencia tienes entrenando?', help:'La carga inicial se adaptará a tu nivel.', type:'choice', options:['Principiante','Intermedio','Avanzado']},
  {key:'trainingDays', title:'¿Qué días puedes entrenar?', help:'Selecciona la distribución que más se acerque a tu semana.', type:'choice', options:['Lunes, miércoles y viernes','Lunes, martes, jueves y viernes','Lunes a viernes','Martes, jueves y sábado','Días variables']},
  {key:'sessionMinutes', title:'¿Cuánto tiempo tienes por sesión?', help:'Incluye calentamiento y descansos.', type:'choice', options:['30','45','60','75','90']},
  {key:'trainingTypes', title:'¿Qué modalidades quieres incluir?', help:'Puedes escribir una combinación de gimnasio, carrera, trail, ciclismo, movilidad u otras.', type:'text'},
  {key:'equipment', title:'¿Qué material tienes disponible?', help:'La selección condiciona los ejercicios posibles.', type:'choice', options:['Gimnasio completo','Mancuernas y banco','Barra y rack','Entreno en casa con poco material','Solo exterior']},
  {key:'sleepHours', title:'¿Cuánto sueles dormir?', help:'Promedio habitual aproximado.', type:'choice', options:['Menos de 6 h','6–7 h','7–8 h','Más de 8 h','Muy variable']},
  {key:'limitations', title:'¿Tienes lesiones o movimientos que debamos evitar?', help:'No compartas más información médica de la necesaria.', type:'text'},
  {key:'priority', title:'¿Qué quieres priorizar?', help:'Indica los grupos, habilidades o distancias más importantes.', type:'text'},
  {key:'intensity', title:'¿Cómo prefieres entrenar?', help:'La IA utilizará esto para sugerir volumen y esfuerzo.', type:'choice', options:['Suave y progresivo','Moderado','Exigente, con control de fatiga']},
  {key:'otherSports', title:'¿Qué otras actividades realizas semanalmente?', help:'Incluye ciclismo, trail, deportes de equipo, trabajo físico, etc.', type:'text'},
  {key:'target', title:'¿Qué resultado te gustaría alcanzar?', help:'Puedes indicar una meta y un horizonte aproximado.', type:'text'},
];
type DialogState = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm?: () => void | Promise<void>; };
type AppData = { profile: Profile; activeSession?: ActiveSession; history: CompletedSession[]; bodyMeasurements: BodyMeasurement[]; recoveryEntries: RecoveryEntry[]; programStartDate?: string; reminderEnabled: boolean; reminderIds: string[]; planAdjustments?: Record<string, CoachAdjustment>; pendingCoachAdjustments?: CoachAdjustment[]; coachReport?: string; coachLastUpdatedAt?: string; autoCoachEnabled?: boolean; coachAccessCode?: string; customProgram?: DayPlan[]; scheduledPlans?: Record<string, DayPlan>; importedPlanName?: string; onboarding?: OnboardingState; chatMessages?: ChatMessage[]; };
type Tab = 'inicio' | 'plan' | 'sesion' | 'progreso' | 'recuperacion' | 'perfil' | 'coach';

const DEFAULT_DATA: AppData = {
  bodyMeasurements: [{ id: 'baseline-2026-10-09', dateKey: '2026-10-09', weightKg: 66.1, bodyFatPercent: 13.0, fatFreeKg: 57.5, muscleKg: 34.6, bmrKcal: 1528, source: 'bascula' }],
  profile: { name: 'Marc', age: '19', heightCm: '188', currentWeightKg: '66.1', goalWeightKg: '70', goalFatPercent: '12', notes: 'Nombre y algunos datos del perfil pendientes de confirmar.' },
  history: [], recoveryEntries: [], reminderEnabled: false, reminderIds: [],
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function prettyDate(date: Date) { return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); }
function getPlan(day: number) { return weeklyPlan.find(p => p.day === day) ?? weeklyPlan[0]; }
function getUserPlan(day: number, targetDateKey: string, data: AppData): DayPlan {
  const dated = data.scheduledPlans?.[targetDateKey];
  if (dated) return dated;
  return data.customProgram?.find(item => item.day === day) ?? getPlan(day);
}
function blankNewUserData(username = ''): AppData {
  return { ...DEFAULT_DATA, profile: { name: username, age: '', heightCm: '', currentWeightKg: '', goalWeightKg: '', goalFatPercent: '', notes: '' }, bodyMeasurements: [], history: [], recoveryEntries: [], customProgram: undefined, scheduledPlans: {}, onboarding: { completed: false }, chatMessages: [] };
}

function fallbackProgramFromAnswers(answers: OnboardingAnswers): DayPlan[] {
  const daysAnswer = answers.trainingDays.toLowerCase();
  let preferredGymDays = daysAnswer.includes('lunes, miércoles') ? [1, 3, 5] : daysAnswer.includes('martes, jueves y sábado') ? [2, 4, 6] : daysAnswer.includes('lunes a viernes') ? [1, 2, 3, 4, 5] : [1, 2, 4, 5];
  const types = `${answers.trainingTypes} ${answers.otherSports}`.toLowerCase();
  const includesTrail = /trail|montaña|carrera|running/.test(types);
  const includesBike = /ciclismo|btt|bici|bike/.test(types);
  const strengthTemplates = weeklyPlan.filter(p => p.kind === 'strength');
  const reserved = new Set<number>([...(includesTrail ? [0] : []), ...(includesBike ? [6] : [])]);
  const gymDays = preferredGymDays.filter(day => !reserved.has(day));
  let strengthIndex = 0;
  const minutes = Number(answers.sessionMinutes) || 60;
  const goalNote = answers.primaryGoal === 'Rendimiento de resistencia'
    ? 'Prioriza la conservación de fuerza y compatibilidad con las sesiones de resistencia.'
    : `Objetivo declarado: ${answers.primaryGoal}. Prioridad: ${answers.priority || 'por confirmar'}.`;
  return Array.from({ length: 7 }, (_, day) => {
    const base = getPlan(day);
    if (day === 0 && includesTrail) return { ...base, sourceStatus: 'propuesta' as const, note: 'Sesión de trail incorporada por el cuestionario. La carga y el recorrido se revisan según experiencia y recuperación.' };
    if (day === 6 && includesBike) return { ...base, sourceStatus: 'propuesta' as const, note: 'Sesión de ciclismo incorporada por el cuestionario. Ajustar distancia e intensidad a tu experiencia y al tiempo disponible.' };
    if (gymDays.includes(day)) {
      const template = strengthTemplates[Math.min(strengthIndex, strengthTemplates.length - 1)];
      strengthIndex += 1;
      const setsFactor = answers.experience === 'Principiante' ? 0.75 : answers.experience === 'Avanzado' ? 1 : 0.9;
      const exerciseLimit = minutes <= 30 ? 3 : minutes <= 45 ? 4 : minutes <= 60 ? 5 : 7;
      const exercises = template.exercises.slice(0, exerciseLimit).map((exercise, index) => ({
        ...exercise,
        id: `onboard-${day}-${index}-${exercise.id}`,
        sets: Math.max(2, Math.round(exercise.sets * setsFactor)),
        weightKg: undefined,
        loadStatus: 'sin_confirmar' as const,
        notes: `Carga inicial sin confirmar. ${exercise.notes ?? ''} Ajusta con técnica y RIR; no se considera una carga probada.`,
      }));
      return { ...template, day, exercises, duration: `${minutes} min`, time: undefined, sourceStatus: 'propuesta' as const, note: `${goalNote} Plan base creado sin IA; revisa ejercicios, limitaciones y cargas antes de empezar.` };
    }
    return { day, title: 'Descanso / recuperación', subtitle: 'Recuperación y movilidad opcional', kind: 'recovery' as const, duration: 'Flexible', exercises: [], sourceStatus: 'propuesta' as const, note: 'Día sin sesión principal según la disponibilidad declarada. Puedes descansar o realizar movilidad suave si te sienta bien.' };
  });
}

function normalizeProgram(raw: unknown, fallback: DayPlan[]): DayPlan[] {
  if (!Array.isArray(raw)) return fallback;
  const byDay = new Map<number, DayPlan>();
  for (const candidate of raw.slice(0, 7) as any[]) {
    const day = Number(candidate?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || typeof candidate?.title !== 'string') continue;
    const kind: DayPlan['kind'] = ['strength','endurance','recovery','rest'].includes(candidate.kind) ? candidate.kind : 'strength';
    const exercises: Exercise[] = Array.isArray(candidate.exercises) ? candidate.exercises.slice(0, 16).map((item: any, index: number) => ({
      id: typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ? item.id : `ai-${day}-${index}`,
      name: typeof item.name === 'string' ? item.name.slice(0, 100) : 'Ejercicio',
      sets: Number.isInteger(item.sets) ? Math.max(1, Math.min(8, item.sets)) : 3,
      reps: typeof item.reps === 'string' && /^\d{1,2}(?:[–-]\d{1,2})?$/.test(item.reps) ? item.reps : '8–12',
      weightKg: typeof item.weightKg === 'number' && Number.isFinite(item.weightKg) && item.weightKg > 0 ? item.weightKg : undefined,
      loadStatus: item.loadStatus === 'declarada' ? 'declarada' : 'propuesta',
      restSeconds: Number.isInteger(item.restSeconds) ? Math.max(30, Math.min(300, item.restSeconds)) : 90,
      rir: Number.isInteger(item.rir) ? Math.max(0, Math.min(5, item.rir)) : 2,
      group: typeof item.group === 'string' ? item.group.slice(0, 60) : 'General',
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 300) : 'Carga inicial propuesta; valida técnica y esfuerzo.',
      adjustmentNote: undefined,
    })) : [];
    byDay.set(day, { day, title: candidate.title.slice(0, 80), subtitle: typeof candidate.subtitle === 'string' ? candidate.subtitle.slice(0, 120) : '', kind, time: typeof candidate.time === 'string' ? candidate.time.slice(0, 5) : undefined, duration: typeof candidate.duration === 'string' ? candidate.duration.slice(0, 60) : undefined, exercises: kind === 'strength' ? exercises : [], sourceStatus: 'propuesta', note: typeof candidate.note === 'string' ? candidate.note.slice(0, 500) : 'Plan importado o generado; revisa cargas y limitaciones.' });
  }
  return Array.from({ length: 7 }, (_, day) => byDay.get(day) ?? { ...fallback.find(p => p.day === day) ?? getPlan(day) });
}
function kgText(v?: number) { return v === undefined ? 'Peso corporal' : `${String(v).replace('.', ',')} kg`; }
function safeNum(text: string) { if (!text.trim()) return undefined; const parsed = Number(text.replace(',', '.')); return Number.isFinite(parsed) ? parsed : undefined; }
function sessionSetCount(session?: ActiveSession) { return session ? Object.values(session.sets).reduce((sum, sets) => sum + sets.length, 0) : 0; }
function allLogs(session?: ActiveSession) { return session ? Object.values(session.sets).flat() : []; }
function sessionVolume(logs: SetLog[]) { return logs.reduce((sum, set) => sum + (set.weightKg ?? 0) * set.reps, 0); }
function formatDuration(totalSeconds: number) { const h = Math.floor(totalSeconds/3600); const m = Math.floor((totalSeconds%3600)/60); const s = totalSeconds%60; return h ? `${h} h ${String(m).padStart(2,'0')} min` : `${m}:${String(s).padStart(2,'0')}`; }
function formatPace(minPerKm: number) { const totalSeconds = Math.max(0, Math.round(minPerKm * 60)); return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`; }
function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function parseDateKey(key: string) { const [y,m,d] = key.split('-').map(Number); return new Date(y, m-1, d); }
function mondayKey(key: string) { const date = parseDateKey(key); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return dateKey(date); }
function utcDayNumber(key: string) { const [y,m,d] = key.split('-').map(Number); return Math.floor(Date.UTC(y,m-1,d) / 86400000); }
function roundToStep(value: number, step: number) { return Math.max(0, Math.round(value / step) * step); }
function adjustmentKey(targetDateKey: string, exerciseId: string) { return `${targetDateKey}::${exerciseId}`; }
function trainingFeedbackSignal(history: CompletedSession[], targetDateKey: string): { status: 'sin-datos' | 'buena' | 'moderada' | 'baja'; reasons: string[] } {
  const target = utcDayNumber(targetDateKey);
  const recent = history.filter(s => s.status !== 'abandoned' && s.feedback && s.dateKey <= targetDateKey && target - utcDayNumber(s.dateKey) <= 5).sort((a,b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 3);
  if (!recent.length) return { status: 'sin-datos', reasons: [] };
  const severe = recent.filter(s => (s.feedback?.rpe ?? 0) >= 9 || (s.feedback?.mood ?? 5) <= 2).length;
  const averageRpe = recent.reduce((sum, s) => sum + (s.feedback?.rpe ?? 0), 0) / recent.length;
  const last = recent[0].feedback!;
  if ((last.rpe >= 9 && last.mood <= 2) || severe >= 2) return { status: 'baja', reasons: ['La valoración reciente combina esfuerzo alto o sensaciones bajas en más de una sesión.'] };
  const heavyOutdoor = recent.find(session => {
    const metrics = session.feedback?.metrics ?? {};
    const outdoor = /trail|ciclismo|btt|carrera/i.test(session.title);
    const substantialLoad = session.durationSeconds >= 3 * 3600 || (metrics.distanceKm ?? 0) >= (/ciclismo|btt/i.test(session.title) ? 40 : 15) || (metrics.elevationGainM ?? 0) >= 700;
    return outdoor && substantialLoad && (session.feedback?.rpe ?? 0) >= 7;
  });
  if (heavyOutdoor && ((heavyOutdoor.feedback?.rpe ?? 0) >= 9 || (heavyOutdoor.feedback?.mood ?? 5) <= 2)) return { status: 'baja', reasons: ['Una sesión reciente de resistencia acumuló una carga elevada y se percibió como muy exigente.'] };
  if (heavyOutdoor) return { status: 'moderada', reasons: ['Una sesión reciente de trail o ciclismo tuvo carga relevante; se moderará la progresión de fuerza cercana.'] };
  if (last.rpe >= 8 || last.mood <= 2 || (recent.length >= 3 && averageRpe >= 8)) return { status: 'moderada', reasons: ['Tus últimas sensaciones sugieren que conviene controlar la exigencia y no forzar una subida.'] };
  if (recent.length >= 2 && recent.every(s => (s.feedback?.mood ?? 0) >= 4 && (s.feedback?.rpe ?? 10) <= 7)) return { status: 'buena', reasons: ['Las últimas sesiones se han percibido como manejables y con buenas sensaciones.'] };
  return { status: 'sin-datos', reasons: [] };
}
function blockInfo(targetDateKey: string, startDateKey?: string) {
  if (!startDateKey) return { week: 1, cycle: 1, phase: 'Acumulación', started: false };
  const weeksElapsed = Math.max(0, Math.floor((utcDayNumber(targetDateKey) - utcDayNumber(startDateKey)) / 7));
  const week = (weeksElapsed % 8) + 1;
  const cycle = Math.floor(weeksElapsed / 8) + 1;
  const phase = week <= 3 ? 'Acumulación' : week <= 5 ? 'Intensificación' : week <= 7 ? 'Consolidación' : 'Descarga';
  return { week, cycle, phase, started: true };
}
function readinessAssessment(entry: Partial<RecoveryEntry>, history: RecoveryEntry[]): { status: Readiness; score: number; reasons: string[]; recommendation: string } {
  const reasons: string[] = [];
  let score = 0;
  let metrics = 0;
  if (entry.sleepHours !== undefined) { metrics++; if (entry.sleepHours < 5.5) { score += 2; reasons.push('Sueño inferior a 5 h 30 min'); } else if (entry.sleepHours < 6.5) { score += 1; reasons.push('Sueño algo corto'); } }
  if (entry.sleepScore !== undefined) { metrics++; if (entry.sleepScore < 40) { score += 2; reasons.push('Puntuación de sueño baja'); } else if (entry.sleepScore < 65) { score += 1; reasons.push('Puntuación de sueño moderada'); } }
  const previousHrv = history.filter(e => e.hrvMs !== undefined && e.hrvMs > 0).slice(-7).map(e => e.hrvMs as number);
  if (entry.hrvMs !== undefined && entry.hrvMs > 0) {
    metrics++;
    if (previousHrv.length >= 3) { const avg = previousHrv.reduce((a,b)=>a+b,0)/previousHrv.length; if (entry.hrvMs < avg*0.8) { score += 2; reasons.push('VFC claramente inferior a tu referencia reciente'); } else if (entry.hrvMs < avg*0.9) { score += 1; reasons.push('VFC algo inferior a tu referencia'); } }
  }
  const previousRhr = history.filter(e => e.restingHrBpm !== undefined && e.restingHrBpm > 0).slice(-7).map(e => e.restingHrBpm as number);
  if (entry.restingHrBpm !== undefined && entry.restingHrBpm > 0) {
    metrics++;
    if (previousRhr.length >= 3) { const avg = previousRhr.reduce((a,b)=>a+b,0)/previousRhr.length; if (entry.restingHrBpm >= avg+8) { score += 2; reasons.push('Pulso en reposo elevado respecto a tu referencia'); } else if (entry.restingHrBpm >= avg+5) { score += 1; reasons.push('Pulso en reposo algo elevado'); } }
  }
  if (entry.bodyBattery !== undefined) { metrics++; if (entry.bodyBattery < 25) { score += 2; reasons.push('Body Battery bajo'); } else if (entry.bodyBattery < 40) { score += 1; reasons.push('Body Battery moderado-bajo'); } }
  if (entry.stressScore !== undefined) { metrics++; if (entry.stressScore >= 75) { score += 2; reasons.push('Estrés diario alto'); } else if (entry.stressScore >= 60) { score += 1; reasons.push('Estrés diario elevado'); } }
  if (entry.energyScore !== undefined) { metrics++; if (entry.energyScore <= 2) { score += 2; reasons.push('Energía percibida muy baja'); } else if (entry.energyScore <= 4) { score += 1; reasons.push('Energía percibida baja'); } }
  if (metrics === 0) return { status: 'sin-datos', score: 0, reasons: [], recommendation: 'La captura se ha guardado. Añade al menos una métrica para generar una recomendación.' };
  if (score >= 4) return { status: 'baja', score, reasons, recommendation: 'Recuperación baja: la próxima sesión de fuerza reducirá moderadamente la carga recomendada y quitará una serie en ejercicios de 3 o más series. Evita buscar el fallo y reevalúa cómo te encuentras.' };
  if (score >= 2) return { status: 'moderada', score, reasons, recommendation: 'Recuperación moderada: mantén las cargas recomendadas, prioriza la técnica y deja aproximadamente 1 repetición más en reserva. La sesión no se reduce automáticamente.' };
  return { status: 'buena', score, reasons, recommendation: 'No aparecen señales claras de recuperación baja en las métricas disponibles. Mantén el plan y decide según tus sensaciones.' };
}
function latestReadiness(entries: RecoveryEntry[], targetDateKey: string) {
  // Para fechas del calendario pasadas, usa la lectura más reciente de esa fecha o anterior; nunca una futura.
  const entry = [...entries]
    .filter(item => item.dateKey <= targetDateKey)
    .sort((a,b)=>b.dateKey.localeCompare(a.dateKey) || b.createdAt.localeCompare(a.createdAt))[0];
  if (!entry) return { status: 'sin-datos' as Readiness, entry: undefined as RecoveryEntry | undefined };
  const ageDays = utcDayNumber(targetDateKey) - utcDayNumber(entry.dateKey);
  if (ageDays > 2) return { status: 'sin-datos' as Readiness, entry };
  return { status: entry.readiness, entry };
}
function durationMinutesFromLabel(value?: string): number | undefined {
  if (!value) return undefined;
  const text = value.toLowerCase().replace(',', '.');
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*min/);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : undefined;
}
function getAdaptivePlan(day: number, targetDateKey: string, data: AppData): DayPlan {
  const base = getUserPlan(day, targetDateKey, data);
  const recoveryReadiness = latestReadiness(data.recoveryEntries ?? [], targetDateKey);
  const feedbackReadiness = trainingFeedbackSignal(data.history ?? [], targetDateKey);
  const combinedStatus: Readiness = recoveryReadiness.status === 'baja' || feedbackReadiness.status === 'baja' ? 'baja' : recoveryReadiness.status === 'moderada' || feedbackReadiness.status === 'moderada' ? 'moderada' : recoveryReadiness.status === 'buena' || feedbackReadiness.status === 'buena' ? 'buena' : 'sin-datos';
  const readiness = { ...recoveryReadiness, status: combinedStatus };

  // Resistencia también se adapta: no cambia la naturaleza de la sesión, pero puede sugerir menos duración y/o intensidad más suave.
  if (base.kind === 'endurance') {
    const baseDuration = durationMinutesFromLabel(base.duration);
    const override = data.planAdjustments?.[adjustmentKey(targetDateKey, '__session__')];
    let durationMinutes = baseDuration;
    let note = base.note ?? '';
    let intensity: 'easy' | 'moderate' | undefined;
    if (readiness.status === 'baja' && baseDuration !== undefined) {
      durationMinutes = Math.max(20, Math.floor((baseDuration * 0.8) / 5) * 5);
      intensity = 'easy';
      note = `Ajuste local por recuperación baja: considera reducir la duración de ${baseDuration} a ${durationMinutes} min y mantener intensidad muy suave. No intentes recuperar volumen perdido en la siguiente sesión. ${base.note ?? ''}`.trim();
    } else if (readiness.status === 'moderada') {
      intensity = 'easy';
      note = `Recuperación moderada: conserva la actividad si te encuentras bien, pero prioriza intensidad suave/conversacional y recorta la sesión si las sensaciones empeoran. ${base.note ?? ''}`.trim();
    }
    if (override?.sessionDurationMinutes !== undefined && baseDuration !== undefined) durationMinutes = Math.min(baseDuration, Math.max(20, override.sessionDurationMinutes));
    if (override?.sessionIntensity) intensity = override.sessionIntensity;
    if (override?.reason) note = `${override.reason}${intensity ? ` Intensidad recomendada: ${intensity === 'easy' ? 'suave y conversacional' : 'moderada'}.` : ''} ${base.note ?? ''}`.trim();
    const duration = durationMinutes !== undefined && (readiness.status === 'baja' || override?.sessionDurationMinutes !== undefined)
      ? `${durationMinutes} min recomendados`
      : base.duration;
    return { ...base, duration, note };
  }

  if (base.kind !== 'strength') return base;
  const phase = blockInfo(targetDateKey, data.programStartDate);
  const exercisePlans = base.exercises.map(exercise => {
    let weightKg = exercise.weightKg;
    let sets = exercise.sets;
    let reps = exercise.reps;
    let rir = exercise.rir;
    let restSeconds = exercise.restSeconds;
    let adjustmentNote = '';
    const originalRange = exercise.reps.split(/[–-]/).map(x => Number(x.trim())).filter(n => Number.isFinite(n));
    const originalMax = originalRange.length > 1 ? originalRange[originalRange.length-1] : (originalRange[0] || 10);
    if (phase.week >= 4 && phase.week <= 5) reps = originalMax <= 10 ? '6–9' : originalMax <= 15 ? '8–12' : '10–15';
    if (phase.week >= 6 && phase.week <= 7) { reps = originalMax <= 10 ? '5–8' : originalMax <= 15 ? '8–10' : '10–12'; rir = 1; }
    if (phase.week === 8) rir = 3;

    const candidates = [...(data.history ?? [])]
      .filter(s => s.status !== 'abandoned' && s.dateKey <= targetDateKey && s.sets?.some(log => log.exerciseId === exercise.id))
      .sort((a,b) => b.endedAt.localeCompare(a.endedAt));
    // Avoid using the lighter deload session as the new block's baseline.
    const prior = candidates.find(s => blockInfo(s.dateKey, data.programStartDate).week !== 8) ?? candidates[0];
    const logs = prior?.sets.filter(log => log.exerciseId === exercise.id) ?? [];
    const activeRange = reps.split(/[–-]/).map(x => Number(x.trim())).filter(n => Number.isFinite(n));
    const maxTarget = activeRange.length > 1 ? activeRange[activeRange.length-1] : (activeRange[0] || 10);
    if (logs.length) {
      const lastLoad = [...logs].reverse().find(log => log.weightKg !== undefined)?.weightKg;
      if (lastLoad !== undefined) weightKg = lastLoad;
      const requiredRir = phase.week >= 6 && phase.week <= 7 ? 1 : 2;
      const reachedTop = logs.length >= exercise.sets && logs.slice(0, exercise.sets).every(log => log.reps >= maxTarget && (log.rir === undefined || log.rir >= requiredRir));
      if (reachedTop && weightKg !== undefined && readiness.status !== 'moderada' && readiness.status !== 'baja' && phase.week !== 8) {
        const smallIncrement = /mancuernas|laterales|pájaros|curl inclinado|martillo/i.test(exercise.name) ? 1 : 2.5;
        weightKg = Math.round((weightKg + smallIncrement) * 10) / 10;
        adjustmentNote = `Progresión automática propuesta: completaste el rango alto en todas las series la última vez. Se propone subir ${String(smallIncrement).replace('.', ',')} kg.`;
      } else if (lastLoad !== undefined) {
        adjustmentNote = 'Carga basada en la última sesión elegible registrada. Mantén el peso hasta consolidar el rango objetivo con buena técnica.';
      }
    }
    if (phase.week === 8) {
      sets = Math.max(1, Math.ceil(sets / 2));
      if (weightKg !== undefined) weightKg = roundToStep(weightKg * 0.9, /mancuernas|laterales|pájaros|curl inclinado|martillo/i.test(exercise.name) ? 1 : 2.5);
      adjustmentNote = 'Semana de descarga automática: volumen reducido aproximadamente a la mitad, carga rebajada alrededor de un 10 % y objetivo de RIR 3.';
    } else if (readiness.status === 'baja') {
      if (weightKg !== undefined) {
        const step = /mancuernas|laterales|pájaros|curl inclinado|martillo/i.test(exercise.name) ? 1 : 2.5;
        weightKg = roundToStep(weightKg * 0.95, step);
      }
      if (sets >= 3) sets -= 1;
      adjustmentNote = 'Ajuste por recuperación baja reciente: carga moderadamente reducida cuando procede y una serie menos. Revisa síntomas y sensaciones antes de entrenar.';
    } else if (readiness.status === 'moderada') {
      adjustmentNote = 'Recuperación moderada: se mantiene la carga en lugar de aumentarla; prioriza técnica y deja más repeticiones en reserva.';
    }
    const override = data.planAdjustments?.[adjustmentKey(targetDateKey, exercise.id)];
    if (override) {
      weightKg = override.weightKg ?? weightKg;
      sets = override.sets ?? sets;
      reps = override.reps ?? reps;
      restSeconds = override.restSeconds ?? restSeconds;
      adjustmentNote = override.reason || 'Ajuste de entrenamiento aplicado desde el entrenador IA.';
    }
    if (feedbackReadiness.status === 'baja' && readiness.status === 'baja' && !adjustmentNote.includes('recuperación baja') && phase.week !== 8) {
      adjustmentNote = `${adjustmentNote ? `${adjustmentNote} ` : ''}Sensaciones recientes bajas y esfuerzo alto: prioriza técnica y evita entrenar al fallo.`;
    }
    return { ...exercise, sets, reps, rir, weightKg, restSeconds, adjustmentNote: adjustmentNote || exercise.adjustmentNote };
  });
  return { ...base, exercises: exercisePlans };
}

export default function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authUser, setAuthUser] = useState<AuthLikeUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [onboardingMessage, setOnboardingMessage] = useState('');
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'off'|'syncing'|'synced'|'error'>('off');
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers>(EMPTY_ONBOARDING);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [pdfImportBusy, setPdfImportBusy] = useState(false);
  const [pdfImportMessage, setPdfImportMessage] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const [recoveryEditingId, setRecoveryEditingId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [modalWeight, setModalWeight] = useState('');
  const [modalReps, setModalReps] = useState('');
  const [modalRir, setModalRir] = useState('');
  const [restRemaining, setRestRemaining] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());
  const [profileDraft, setProfileDraft] = useState<Profile>(DEFAULT_DATA.profile);
  const [measurementDraft, setMeasurementDraft] = useState<MeasurementDraft>({ weightKg: DEFAULT_DATA.profile.currentWeightKg, bodyFatPercent: '', waistCm: '', armCm: '', chestCm: '' });
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [finishReviewOpen, setFinishReviewOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(EMPTY_REVIEW_DRAFT);
  const [coachEndpoint, setCoachEndpoint] = useState(Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/.netlify/functions/coach-ai` : (process.env.EXPO_PUBLIC_COACH_API_URL ?? ''));
  const [coachAccessCode, setCoachAccessCode] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft>({ dateKey: dateKey(new Date()), sleepHours: '', sleepScore: '', hrvMs: '', restingHrBpm: '', bodyBattery: '', stressScore: '', energyScore: '', notes: '' });
  const [recoveryImage, setRecoveryImage] = useState<string | undefined>(undefined);
  const [removeRecoveryImage, setRemoveRecoveryImage] = useState(false);
  const lastHapticEnd = useRef<number | null>(null);

  const today = new Date();
  const todayPlan = getAdaptivePlan(today.getDay(), dateKey(today), data);
  const chosenDate = useMemo(() => {
    const [y,m,d] = selectedDate.split('-').map(Number);
    return new Date(y, m-1, d);
  }, [selectedDate]);
  const selectedPlan = getAdaptivePlan(chosenDate.getDay(), selectedDate, data);
  const activePlan = data.activeSession ? getAdaptivePlan(data.activeSession.day, data.activeSession.dateKey, data) : undefined;
  const selectedBlock = blockInfo(selectedDate, data.programStartDate);
  const selectedReadiness = latestReadiness(data.recoveryEntries ?? [], selectedDate);
  const activeExercise: Exercise | undefined = data.activeSession && activePlan?.kind === 'strength' ? activePlan.exercises[data.activeSession.exerciseIndex] : undefined;
  const exerciseLogs = activeExercise && data.activeSession ? (data.activeSession.sets[activeExercise.id] ?? []) : [];
  const loggedSets = sessionSetCount(data.activeSession);
  const plannedSets = activePlan?.exercises.reduce((sum,e) => sum + e.sets, 0) ?? 0;
  const progressPct = plannedSets ? Math.min(100, Math.round(loggedSets/plannedSets*100)) : 0;
  const activitySummary = useMemo(() => {
    const sessions = data.history.filter(session => session.status !== 'abandoned' && session.feedback);
    const metricSessions = sessions.filter(session => {
      const metrics = session.feedback?.metrics ?? {};
      return metrics.distanceKm !== undefined || metrics.elevationGainM !== undefined || metrics.avgHrBpm !== undefined;
    });
    const distances = metricSessions.map(session => session.feedback?.metrics.distanceKm).filter((value): value is number => value !== undefined);
    const elevations = metricSessions.map(session => session.feedback?.metrics.elevationGainM).filter((value): value is number => value !== undefined);
    const heartRates = metricSessions.map(session => session.feedback?.metrics.avgHrBpm).filter((value): value is number => value !== undefined);
    const latestPace = sessions.find(session => session.feedback?.metrics.paceMinPerKm !== undefined)?.feedback?.metrics.paceMinPerKm;
    const latestSpeed = sessions.find(session => session.feedback?.metrics.avgSpeedKmh !== undefined)?.feedback?.metrics.avgSpeedKmh;
    return {
      sessionCount: metricSessions.length,
      totalDistanceKm: distances.reduce((sum, value) => sum + value, 0),
      totalElevationM: elevations.reduce((sum, value) => sum + value, 0),
      averageHeartRate: heartRates.length ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length : undefined,
      latestPace,
      latestSpeed,
    };
  }, [data.history]);
  const recoveryInsights = useMemo(() => {
    const entries = [...(data.recoveryEntries ?? [])].sort((a,b)=>b.dateKey.localeCompare(a.dateKey)).slice(0,7);
    const sleeps = entries.map(e=>e.sleepHours).filter((v): v is number => v !== undefined);
    const scores = entries.map(e=>e.sleepScore).filter((v): v is number => v !== undefined);
    const latest = entries[0];
    const sessions = (data.history ?? []).filter(s=>s.status !== 'abandoned' && s.feedback).slice(0,5);
    const rpeAvg = sessions.length ? sessions.reduce((sum,s)=>sum+(s.feedback?.rpe ?? 0),0)/sessions.length : undefined;
    const moodAvg = sessions.length ? sessions.reduce((sum,s)=>sum+(s.feedback?.mood ?? 0),0)/sessions.length : undefined;
    const sleepAvg = sleeps.length ? sleeps.reduce((a,b)=>a+b,0)/sleeps.length : undefined;
    const sleepScoreAvg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : undefined;
    let fatigue = 'No hay suficientes registros para valorar una tendencia con confianza.';
    if ((latest?.readiness === 'baja') || (rpeAvg !== undefined && rpeAvg >= 8 && moodAvg !== undefined && moodAvg <= 3)) fatigue = 'Señales de fatiga elevadas: conviene revisar carga, sueño y sensaciones antes de progresar.';
    else if ((latest?.readiness === 'moderada') || (rpeAvg !== undefined && rpeAvg >= 7.5)) fatigue = 'Precaución moderada: evita forzar subidas y presta atención a la calidad del movimiento.';
    else if (entries.length >= 2 && sessions.length >= 2) fatigue = 'Las señales registradas no muestran una alerta clara. Sigue comparando la tendencia, no un valor aislado.';
    return { entries, sleepAvg, sleepScoreAvg, latest, rpeAvg, moodAvg, fatigue };
  }, [data.recoveryEntries, data.history]);

  useEffect(() => {
    if (supabaseConfigured) {
      let active = true;
      supabase?.auth.getSession().then(({ data: sessionData }) => {
        if (active) { setAuthUser(sessionData.session?.user as AuthLikeUser ?? null); setAuthReady(true); }
      }).catch(() => { if (active) setAuthReady(true); });
      const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
        setAuthUser(session?.user as AuthLikeUser ?? null);
        setAuthReady(true);
      }).data.subscription;
      return () => { active = false; subscription?.unsubscribe(); };
    }
    return undefined;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (supabaseConfigured && !authReady) return;
      if (supabaseConfigured && !authUser) {
        setLoaded(true);
        setDataOwnerId(null);
        return;
      }
      setLoaded(false);
      const userId = supabaseConfigured ? authUser?.id ?? null : null;
      const localKey = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
      try {
        let parsed: Partial<AppData> | null = null;
        let foundCloud = false;
        if (userId && supabase) {
          const cloud = await supabase.from('user_app_data').select('payload').eq('user_id', userId).maybeSingle();
          if (cloud.error) setCloudStatus('error');
          if (cloud.data?.payload && typeof cloud.data.payload === 'object') {
            parsed = cloud.data.payload as Partial<AppData>;
            foundCloud = true;
          }
        }
        if (!parsed) {
          const raw = await AsyncStorage.getItem(localKey);
          if (raw) parsed = JSON.parse(raw) as Partial<AppData>;
        }
        // One-time migration of the existing single-user data to the first signed-in account only.
        if (!parsed && userId) {
          const legacyOwner = await AsyncStorage.getItem('@my_training_lab_legacy_owner');
          const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
          if (legacyRaw && !legacyOwner) {
            parsed = JSON.parse(legacyRaw) as Partial<AppData>;
            await AsyncStorage.setItem('@my_training_lab_legacy_owner', userId);
          }
        }
        const existingProfile = parsed?.profile ?? (userId ? { ...DEFAULT_DATA.profile, name: String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? '') } : DEFAULT_DATA.profile);
        const hasLegacyData = Boolean(parsed && (parsed.profile?.name || parsed.history?.length || parsed.bodyMeasurements?.length));
        const blank = userId && !parsed ? blankNewUserData(String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? '')) : DEFAULT_DATA;
        const source: Partial<AppData> = parsed ?? blank;
        const storedProfile = source.profile ?? existingProfile;
        const mergedProfile: Profile = {
          ...((userId && !hasLegacyData) ? blankNewUserData(String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? '')).profile : DEFAULT_DATA.profile),
          ...storedProfile,
          name: storedProfile.name?.trim() ? storedProfile.name : (userId ? String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? '') : DEFAULT_DATA.profile.name),
          age: storedProfile.age?.trim() ? storedProfile.age : (userId && !hasLegacyData ? '' : DEFAULT_DATA.profile.age),
          heightCm: storedProfile.heightCm?.trim() ? storedProfile.heightCm : (userId && !hasLegacyData ? '' : DEFAULT_DATA.profile.heightCm),
          currentWeightKg: storedProfile.currentWeightKg?.trim() ? storedProfile.currentWeightKg : (userId && !hasLegacyData ? '' : DEFAULT_DATA.profile.currentWeightKg),
          goalWeightKg: storedProfile.goalWeightKg?.trim() ? storedProfile.goalWeightKg : (userId && !hasLegacyData ? '' : DEFAULT_DATA.profile.goalWeightKg),
          goalFatPercent: storedProfile.goalFatPercent?.trim() ? storedProfile.goalFatPercent : (userId && !hasLegacyData ? '' : DEFAULT_DATA.profile.goalFatPercent),
        };
        const combined: AppData = {
          ...((userId && !hasLegacyData) ? blankNewUserData(String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? '')) : DEFAULT_DATA),
          ...source,
          profile: mergedProfile,
          history: source.history ?? [],
          bodyMeasurements: source.bodyMeasurements ?? ((userId && !hasLegacyData) ? [] : DEFAULT_DATA.bodyMeasurements),
          recoveryEntries: source.recoveryEntries ?? [], reminderIds: source.reminderIds ?? [],
          programStartDate: source.programStartDate ?? (source.activeSession && getPlan(source.activeSession.day).kind === 'strength' ? source.activeSession.dateKey : undefined),
          onboarding: source.onboarding ?? { completed: Boolean(hasLegacyData), answers: EMPTY_ONBOARDING },
          chatMessages: source.chatMessages ?? [],
          scheduledPlans: source.scheduledPlans ?? {},
        };
        if (cancelled) return;
        setData(combined);
        setCoachAccessCode(combined.coachAccessCode ?? '');
        setProfileDraft(combined.profile);
        setMeasurementDraft(d => ({ ...d, weightKg: combined.profile.currentWeightKg }));
        setOnboardingAnswers({ ...EMPTY_ONBOARDING, ...(combined.onboarding?.answers ?? {}) });
        setOnboardingStep(0);
        setDataOwnerId(userId);
        if (userId && !foundCloud) setCloudStatus('syncing');
      } catch (err) {
        console.warn('No se pudo cargar el almacenamiento de la cuenta', err);
        if (!cancelled) setCloudStatus('error');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authReady, authUser?.id]);

  useEffect(() => {
    if (!loaded || (supabaseConfigured && (!authUser || dataOwnerId !== authUser.id))) return;
    const userId = supabaseConfigured ? authUser?.id : null;
    const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
    const timer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(data));
        if (userId && supabase) {
          setCloudStatus('syncing');
          const { error } = await supabase.from('user_app_data').upsert({ user_id: userId, payload: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
          if (error) throw error;
          setCloudStatus('synced');
        }
      } catch (err) {
        console.warn('No se pudo sincronizar los datos', err);
        if (userId) setCloudStatus('error');
      }
    }, userId ? 600 : 0);
    return () => clearTimeout(timer);
  }, [data, loaded, authUser?.id, dataOwnerId]);

  useEffect(() => {
    const clockTimer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const restEnd = data.activeSession?.restEndsAt;
      if (!restEnd) { setRestRemaining(0); return; }
      const left = Math.max(0, Math.ceil((restEnd - Date.now())/1000));
      setRestRemaining(left);
      if (left === 0 && lastHapticEnd.current !== restEnd) {
        lastHapticEnd.current = restEnd;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setData(current => current.activeSession?.restEndsAt === restEnd ? { ...current, activeSession: { ...current.activeSession!, restEndsAt: undefined, restNotificationId: undefined } } : current);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [data.activeSession?.restEndsAt]);

  const showInfo = useCallback((title: string, message: string) => setDialog({ title, message, confirmLabel: 'ENTENDIDO' }), []);
  const showConfirm = useCallback((config: Omit<DialogState, 'cancelLabel'> & { onConfirm: () => void | Promise<void> }) => setDialog({ ...config, cancelLabel: 'Cancelar' }), []);
  const getAiAuthToken = async () => {
    if (supabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) return sessionData.session.access_token;
    }
    return data.coachAccessCode?.trim() || coachAccessCode.trim();
  };

  const handleAuthSubmit = async () => {
    if (!supabase) { setAuthMessage('La autenticación todavía no está configurada. Añade EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en Netlify y vuelve a desplegar.'); return; }
    const email = authEmail.trim().toLowerCase();
    if (!email) { setAuthMessage('Introduce tu correo electrónico o nombre de usuario.'); return; }
    if ((authMode === 'signup' || email.includes('@')) && !email.includes('@')) { setAuthMessage('Introduce un correo electrónico válido.'); return; }
    if (authMode === 'login' && !email.includes('@') && !/^[a-z0-9.-]{3,24}$/.test(email)) { setAuthMessage('El nombre de usuario debe tener entre 3 y 24 caracteres, usando letras, números, punto o guion.'); return; }
    if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAuthMessage('Introduce un correo electrónico válido.'); return; }
    if (authPassword.length < 8) { setAuthMessage('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (authMode === 'signup' && !/^[a-zA-Z0-9.-]{3,24}$/.test(authUsername.trim())) { setAuthMessage('El nombre de usuario debe tener entre 3 y 24 caracteres: letras, números, punto o guion.'); return; }
    setAuthBusy(true); setAuthMessage('');
    try {
      if (authMode === 'signup') {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { data: { username: authUsername.trim().toLowerCase(), display_name: authUsername.trim() } },
        });
        if (error) throw error;
        if (result.session && result.user) {
          setAuthUser(result.user as AuthLikeUser);
          setAuthMessage('Cuenta creada. Preparando tu perfil personalizado…');
        } else {
          setAuthMessage('Cuenta creada. Revisa tu correo para confirmar la cuenta y después inicia sesión.');
          setAuthMode('login');
        }
      } else {
        if (email.includes('@')) {
          const { data: result, error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
          if (error) throw error;
          setAuthUser(result.user as AuthLikeUser);
        } else {
          const endpoint = coachEndpoint.trim() || (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/.netlify/functions/coach-ai` : '');
          const usernameEndpoint = endpoint.replace(/\/\.netlify\/functions\/coach-ai(?:\?.*)?$/, '/.netlify/functions/username-login');
          if (!usernameEndpoint || usernameEndpoint === endpoint) throw new Error('No se ha podido determinar la URL de inicio por usuario. Configura EXPO_PUBLIC_COACH_API_URL en Netlify para que apunte a la función coach-ai.');
          const signInResponse = await fetch(usernameEndpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:email,password:authPassword}) });
          const sessionBody = await signInResponse.json().catch(()=>({} as any));
          if (!signInResponse.ok || !sessionBody.access_token || !sessionBody.refresh_token) throw new Error(sessionBody.error || 'Nombre de usuario o contraseña incorrectos.');
          const { data: sessionResult, error } = await supabase.auth.setSession({ access_token:sessionBody.access_token, refresh_token:sessionBody.refresh_token });
          if (error) throw error;
          if (!sessionResult.user) throw new Error('La sesión no devolvió un usuario válido.');
          setAuthUser(sessionResult.user as AuthLikeUser);
        }
        setAuthMessage('Sesión iniciada. Cargando tu perfil…');
      }
      setAuthPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la autenticación.';
      setAuthMessage(message.includes('profiles_username_lower_unique') || /username|usuario/i.test(message) ? 'Ese nombre de usuario ya está ocupado o no es válido. Prueba otro.' : message);
    } finally { setAuthBusy(false); }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
    setAuthMessage('');
    setTab('inicio');
  };

  const handlePasswordReset = async () => {
    if (!supabase) { setAuthMessage('La autenticación no está configurada.'); return; }
    const email = authEmail.trim().toLowerCase();
    if (!email.includes('@')) { setAuthMessage('Para recuperar la contraseña, introduce el correo electrónico asociado a la cuenta.'); return; }
    setAuthBusy(true); setAuthMessage('');
    try {
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      setAuthMessage('Si la cuenta existe y la recuperación está habilitada, recibirás un correo con los siguientes pasos.');
    } catch (error) { setAuthMessage(error instanceof Error ? error.message : 'No se pudo solicitar la recuperación.'); }
    finally { setAuthBusy(false); }
  };
  const startSession = useCallback((plan: DayPlan, date: Date) => {
    if (plan.kind === 'rest') { showInfo('Día de descanso', 'No hay entrenamiento planificado para este día.'); return; }
    if (data.activeSession) {
      if (data.activeSession.dateKey === dateKey(date) && data.activeSession.day === plan.day) {
        setTab('sesion'); return;
      }
      showInfo('Hay una sesión sin terminar', 'Vuelve a ella desde Sesión. Finalízala o abandónala antes de iniciar otra.');
      setTab('sesion'); return;
    }
    setData(current => ({ ...current, programStartDate: current.programStartDate ? mondayKey(current.programStartDate) : (plan.kind === 'strength' ? mondayKey(dateKey(date)) : undefined), activeSession: { id: makeId(), day: plan.day, dateKey: dateKey(date), startedAt: new Date().toISOString(), exerciseIndex: 0, sets: {} } }));
    setSessionNote('');
    setTab('sesion');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, [data.activeSession, showInfo]);

  const openSetModal = () => {
    if (!activeExercise || !data.activeSession) return;
    const existing = data.activeSession.sets[activeExercise.id] ?? [];
    setModalWeight(activeExercise.weightKg === undefined ? '' : String(activeExercise.weightKg));
    const rangeStart = Number(activeExercise.reps.split(/[–-]/)[0]);
    setModalReps(String(Number.isFinite(rangeStart) && rangeStart > 0 ? rangeStart : 10));
    setModalRir(activeExercise.rir === undefined ? '' : String(activeExercise.rir));
    setSetModalOpen(true);
  };

  const recordSet = async () => {
    if (!activeExercise || !data.activeSession) return;
    const reps = Math.max(0, Math.floor(Number(modalReps)));
    if (!Number.isFinite(reps) || reps <= 0) { showInfo('Revisa las repeticiones', 'Introduce un número válido de repeticiones.'); return; }
    const weight = activeExercise.loadStatus === 'peso_corporal' && modalWeight.trim() === '' ? undefined : safeNum(modalWeight);
    if (activeExercise.weightKg !== undefined && modalWeight.trim() === '') { showInfo('Falta el peso', 'Introduce el peso real utilizado en esta serie.'); return; }
    if (modalWeight.trim() !== '' && weight === undefined) { showInfo('Revisa el peso', 'Introduce un peso válido, por ejemplo 12,5.'); return; }
    const before = data.activeSession;
    const priorForExercise = before.sets[activeExercise.id] ?? [];
    const log: SetLog = { id: makeId(), exerciseId: activeExercise.id, exerciseName: activeExercise.name, setNumber: priorForExercise.length + 1, weightKg: weight, reps, rir: safeNum(modalRir), createdAt: new Date().toISOString(), plannedWeightKg: activeExercise.weightKg };
    const updatedSets = { ...before.sets, [activeExercise.id]: [...priorForExercise, log] };
    const exerciseComplete = updatedSets[activeExercise.id].length >= activeExercise.sets;
    const nextIndex = exerciseComplete ? before.exerciseIndex + 1 : before.exerciseIndex;
    const hasNext = !exerciseComplete || nextIndex < (activePlan?.exercises.length ?? 0);
    const restEnd = hasNext ? Date.now() + activeExercise.restSeconds * 1000 : undefined;
    let notificationId: string | undefined;
    if (restEnd) {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.granted) {
          notificationId = await Notifications.scheduleNotificationAsync({
            content: { title: 'Descanso terminado', body: `Es hora de continuar: ${exerciseComplete ? 'siguiente ejercicio' : activeExercise.name}.`, sound: true, data: { screen: 'sesion' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(restEnd) },
          });
        }
      } catch (err) { console.warn('No se pudo programar el aviso del descanso', err); }
    }
    setData(current => current.activeSession?.id === before.id ? { ...current, activeSession: { ...current.activeSession, sets: updatedSets, exerciseIndex: nextIndex, restEndsAt: restEnd, restNotificationId: notificationId } } : current);
    setSetModalOpen(false);
    setRestRemaining(restEnd ? activeExercise.restSeconds : 0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const cancelRestNotification = async (id?: string) => { if (id) { try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* notification may already have fired */ } } };
  const skipRest = async () => {
    await cancelRestNotification(data.activeSession?.restNotificationId);
    setData(current => current.activeSession ? { ...current, activeSession: { ...current.activeSession, restEndsAt: undefined, restNotificationId: undefined } } : current);
    setRestRemaining(0);
  };
  const addRest = async (seconds: number) => {
    if (!data.activeSession) return;
    const newEnd = Math.max(Date.now(), data.activeSession.restEndsAt ?? Date.now()) + seconds*1000;
    await cancelRestNotification(data.activeSession.restNotificationId);
    let id: string | undefined;
    try {
      const p = await Notifications.getPermissionsAsync();
      if (p.granted) id = await Notifications.scheduleNotificationAsync({ content: { title: 'Descanso terminado', body: 'Es hora de continuar con tu entrenamiento.', sound: true }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(newEnd) } });
    } catch { /* timer still works in foreground */ }
    setData(current => current.activeSession ? { ...current, activeSession: { ...current.activeSession, restEndsAt: newEnd, restNotificationId: id } } : current);
  };

  const finishSession = (cancelled = false) => {
    const active = data.activeSession;
    if (!active) { showInfo('No hay sesión activa', 'Inicia una sesión desde Inicio o Calendario.'); return; }
    const plan = getAdaptivePlan(active.day, active.dateKey, data);
    const logs = allLogs(active);
    const title = cancelled ? 'Abandonar sesión' : 'Finalizar sesión';
    const message = cancelled
      ? 'La sesión se guardará como incompleta en el historial para conservar las series registradas. ¿Quieres abandonarla?'
      : `Se guardarán ${logs.length} series registradas. Después podrás puntuar la sesión, añadir tus sensaciones y completar las métricas del reloj.`;
    showConfirm({
      title,
      message,
      confirmLabel: cancelled ? 'ABANDONAR SESIÓN' : 'CONTINUAR',
      destructive: cancelled,
      onConfirm: async () => {
        if (!cancelled) {
          setReviewDraft({ ...EMPTY_REVIEW_DRAFT, note: sessionNote.trim() });
          setFinishReviewOpen(true);
          return;
        }
        await cancelRestNotification(active.restNotificationId);
        const endedAt = new Date().toISOString();
        const elapsed = Math.max(0, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000));
        const entry: CompletedSession = {
          id: active.id, day: active.day, dateKey: active.dateKey,
          title: `${plan.title} (incompleto)`, startedAt: active.startedAt, endedAt,
          sets: logs, durationSeconds: elapsed, note: sessionNote.trim() || undefined, status: 'abandoned',
        };
        setData(current => ({ ...current, history: [entry, ...current.history], activeSession: undefined }));
        setSessionNote('');
        setRestRemaining(0);
        setTab('progreso');
      },
    });
  };

  const saveFinalizedSession = async () => {
    const active = data.activeSession;
    if (!active) { setFinishReviewOpen(false); showInfo('No hay sesión activa', 'No encontramos una sesión pendiente de finalizar.'); return; }
    const rpe = safeNum(reviewDraft.rpe);
    if (reviewDraft.mood === null) { showInfo('Puntúa tus sensaciones', 'Selecciona la cara que mejor represente cómo te has sentido.'); return; }
    if (rpe === undefined || rpe < 1 || rpe > 10) { showInfo('Falta el esfuerzo percibido', 'Selecciona un valor de esfuerzo entre 1 y 10.'); return; }

    const numericFields: Array<{ key: keyof ReviewDraft; metricKey: keyof SessionMetrics; label: string; min: number; max: number }> = [
      { key: 'avgHrBpm', metricKey: 'avgHrBpm', label: 'Frecuencia cardíaca media', min: 30, max: 240 },
      { key: 'maxHrBpm', metricKey: 'maxHrBpm', label: 'Frecuencia cardíaca máxima', min: 30, max: 250 },
      { key: 'distanceKm', metricKey: 'distanceKm', label: 'Distancia', min: 0, max: 1500 },
      { key: 'elevationGainM', metricKey: 'elevationGainM', label: 'Desnivel positivo', min: 0, max: 15000 },
      { key: 'avgSpeedKmh', metricKey: 'avgSpeedKmh', label: 'Velocidad media', min: 0, max: 150 },
      { key: 'maxSpeedKmh', metricKey: 'maxSpeedKmh', label: 'Velocidad máxima', min: 0, max: 200 },
      { key: 'paceMinPerKm', metricKey: 'paceMinPerKm', label: 'Ritmo medio (min/km en formato decimal)', min: 0, max: 60 },
      { key: 'caloriesKcal', metricKey: 'caloriesKcal', label: 'Calorías', min: 0, max: 20000 },
      { key: 'avgCadenceRpm', metricKey: 'avgCadenceRpm', label: 'Cadencia media', min: 0, max: 300 },
      { key: 'avgPowerW', metricKey: 'avgPowerW', label: 'Potencia media', min: 0, max: 2500 },
    ];
    const metrics: SessionMetrics = {};
    for (const field of numericFields) {
      const raw = String(reviewDraft[field.key] ?? '');
      if (!raw.trim()) continue;
      const value = safeNum(raw);
      if (value === undefined || value < field.min || value > field.max) {
        showInfo('Revisa las métricas', `${field.label}: introduce un valor entre ${field.min} y ${field.max}.`);
        return;
      }
      metrics[field.metricKey] = value;
    }
    if (metrics.avgHrBpm !== undefined && metrics.maxHrBpm !== undefined && metrics.maxHrBpm < metrics.avgHrBpm) { showInfo('Revisa la frecuencia cardíaca', 'La frecuencia máxima no puede ser inferior a la media.'); return; }
    if (metrics.avgSpeedKmh !== undefined && metrics.maxSpeedKmh !== undefined && metrics.maxSpeedKmh < metrics.avgSpeedKmh) { showInfo('Revisa las velocidades', 'La velocidad máxima no puede ser inferior a la media.'); return; }

    await cancelRestNotification(active.restNotificationId);
    const plan = getAdaptivePlan(active.day, active.dateKey, data);
    const logs = allLogs(active);
    const endedAt = new Date().toISOString();
    const elapsed = Math.max(0, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000));
    const feedback: SessionFeedback = { mood: reviewDraft.mood, rpe, note: reviewDraft.note.trim() || undefined, metrics };
    const entry: CompletedSession = {
      id: active.id, day: active.day, dateKey: active.dateKey, title: plan.title,
      startedAt: active.startedAt, endedAt, sets: logs, durationSeconds: elapsed,
      note: reviewDraft.note.trim() || sessionNote.trim() || undefined, status: 'completed', feedback,
    };
    setData(current => ({ ...current, history: [entry, ...current.history], activeSession: undefined }));
    setSessionNote('');
    setReviewDraft(EMPTY_REVIEW_DRAFT);
    setFinishReviewOpen(false);
    setRestRemaining(0);
    setTab('progreso');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (data.autoCoachEnabled) void runAiCoach({ automatic: true, forceAutoApply: true, extraSession: entry });
  };

  const deleteCompletedSession = (session: CompletedSession) => {
    showConfirm({
      title: 'Eliminar sesión del historial',
      message: `Se eliminará «${session.title}» del ${session.dateKey}, incluidas sus series registradas. Esta acción no se puede deshacer.`,
      confirmLabel: 'ELIMINAR SESIÓN',
      destructive: true,
      onConfirm: () => setData(current => ({ ...current, history: current.history.filter(item => item.id !== session.id) })),
    });
  };

  const applyCoachAdjustments = () => {
    const pending = data.pendingCoachAdjustments ?? [];
    if (!pending.length) { showInfo('No hay cambios pendientes', 'Primero solicita un análisis de IA que proponga cambios para futuros entrenamientos.'); return; }
    setData(current => {
      const updates = { ...(current.planAdjustments ?? {}) };
      pending.forEach(item => { updates[adjustmentKey(item.dateKey, item.exerciseId)] = { ...item, updatedAt: new Date().toISOString() }; });
      return { ...current, planAdjustments: updates, pendingCoachAdjustments: [] };
    });
    showInfo('Ajustes aplicados', `Se han incorporado ${pending.length} ajustes a fechas futuras. Los entrenamientos ya realizados no cambian.`);
  };

  const discardCoachAdjustments = () => setData(current => ({ ...current, pendingCoachAdjustments: [] }));

  const runAiCoach = async (options: CoachRunOptions = {}) => {
    const automatic = options.automatic === true;
    const endpoint = coachEndpoint.trim();
    const accessCode = await getAiAuthToken();
    if (!endpoint || !accessCode) {
      const message = !endpoint ? 'Falta la URL pública de la función de Netlify.' : 'Falta una sesión de cuenta o el código de acceso de la IA. Inicia sesión o configúralo en Progreso.';
      if (automatic) { setData(current => ({ ...current, coachReport: `Modo automático no ejecutado: ${message} El ajuste local del entrenamiento sigue activo.` })); return; }
      showInfo(!endpoint ? 'Configura el asistente IA' : 'Falta el código de acceso', `${message} No introduzcas aquí tu clave privada de Anthropic.`);
      return;
    }
    setCoachBusy(true);
    try {
      const contextData: AppData = {
        ...data,
        history: options.extraSession ? [options.extraSession, ...data.history.filter(session => session.id !== options.extraSession?.id)] : data.history,
        recoveryEntries: options.extraRecovery ? [...data.recoveryEntries.filter(entry => entry.id !== options.extraRecovery?.id), options.extraRecovery].sort((a,b)=>a.dateKey.localeCompare(b.dateKey) || a.createdAt.localeCompare(b.createdAt)) : data.recoveryEntries,
      };
      const autoApply = options.forceAutoApply ?? Boolean(contextData.autoCoachEnabled);
      const todayKey = dateKey(new Date());
      const upcoming = Array.from({ length: 21 }, (_, offset) => {
        const d = new Date(); d.setDate(d.getDate() + offset + 1);
        const key = dateKey(d);
        const plan = getAdaptivePlan(d.getDay(), key, contextData);
        if (plan.kind === 'strength') return { dateKey: key, title: plan.title, kind: plan.kind, plannedDurationMinutes: durationMinutesFromLabel(getUserPlan(d.getDay(), key, contextData).duration), exercises: plan.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weightKg: e.weightKg, restSeconds: e.restSeconds, rir: e.rir, group: e.group })) };
        if (plan.kind === 'endurance') {
          const plannedDurationMinutes = durationMinutesFromLabel(plan.duration);
          return { dateKey: key, title: plan.title, kind: plan.kind, plannedDurationMinutes: durationMinutesFromLabel(getUserPlan(d.getDay(), key, contextData).duration), recommendedDurationMinutes: plannedDurationMinutes, exercises: [{ id: '__session__', name: plan.title, sets: 1, reps: '1', restSeconds: 60, sessionDurationMinutes: plannedDurationMinutes, sessionIntensity: 'moderate' }] };
        }
        return null;
      }).filter(Boolean);
      const recentSessions = contextData.history.filter(item => item.status !== 'abandoned').slice(0, 12).map(session => ({
        dateKey: session.dateKey, title: session.title, durationMinutes: Math.round(session.durationSeconds / 60),
        feedback: session.feedback ? { mood: session.feedback.mood, rpe: session.feedback.rpe, note: session.feedback.note, metrics: session.feedback.metrics } : undefined,
        exercises: (() => {
          type ExerciseSummary = { exerciseId: string; name: string; sets: number; reps: number; loads: number[] };
          const grouped: Record<string, ExerciseSummary> = session.sets.reduce((group, set) => {
            const current: ExerciseSummary = group[set.exerciseId] ?? { exerciseId: set.exerciseId, name: set.exerciseName, sets: 0, reps: 0, loads: [] };
            current.sets += 1; current.reps += set.reps; if (set.weightKg !== undefined) current.loads.push(set.weightKg); group[set.exerciseId] = current; return group;
          }, {} as Record<string, ExerciseSummary>);
          return Object.keys(grouped).map(key => { const e = grouped[key]; return { exerciseId: e.exerciseId, name: e.name, sets: e.sets, reps: e.reps, lastWeightKg: e.loads.length ? e.loads[e.loads.length - 1] : undefined }; });
        })(),
      }));
      const recovery = [...(contextData.recoveryEntries ?? [])].slice(-7).map(entry => ({ dateKey: entry.dateKey, sleepHours: entry.sleepHours, sleepScore: entry.sleepScore, hrvMs: entry.hrvMs, restingHrBpm: entry.restingHrBpm, bodyBattery: entry.bodyBattery, stressScore: entry.stressScore, energyScore: entry.energyScore, readiness: entry.readiness }));
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessCode}` },
        body: JSON.stringify({
          dateKey: todayKey,
          profile: { age: contextData.profile.age, heightCm: contextData.profile.heightCm, currentWeightKg: contextData.profile.currentWeightKg, goalWeightKg: contextData.profile.goalWeightKg, goalFatPercent: contextData.profile.goalFatPercent },
          recentSessions, recovery, upcomingSessions: upcoming,
        }),
      });
      const result = await response.json().catch(() => ({} as any));
      if (!response.ok) throw new Error(result.error || `El servidor respondió ${response.status}.`);
      const report = typeof result.report === 'string' ? result.report.slice(0, 12000) : 'Análisis recibido, pero no se encontró un informe en la respuesta.';
      const allowed = new Map<string, Map<string, { weightKg?: number; sets: number; reps: string; restSeconds: number; kind: 'strength' | 'endurance'; sessionDurationMinutes?: number; baseDurationMinutes?: number; maxDurationMinutes?: number }>>();
      for (const session of upcoming as Array<{ dateKey: string; kind: 'strength' | 'endurance'; plannedDurationMinutes?: number; recommendedDurationMinutes?: number; exercises: Array<{ id: string; weightKg?: number; sets: number; reps: string; restSeconds: number; sessionDurationMinutes?: number }> }>) {
        allowed.set(session.dateKey, new Map(session.exercises.map(ex => [ex.id, { weightKg: ex.weightKg, sets: ex.sets, reps: ex.reps, restSeconds: ex.restSeconds, kind: session.kind, sessionDurationMinutes: ex.sessionDurationMinutes, baseDurationMinutes: session.plannedDurationMinutes, maxDurationMinutes: session.recommendedDurationMinutes ?? session.plannedDurationMinutes }])));
      }
      const validAdjustments: CoachAdjustment[] = [];
      if (Array.isArray(result.adjustments)) {
        for (const item of result.adjustments.slice(0, 35)) {
          if (!item || typeof item.dateKey !== 'string' || typeof item.exerciseId !== 'string' || typeof item.reason !== 'string') continue;
          const age = utcDayNumber(item.dateKey) - utcDayNumber(todayKey);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(item.dateKey) || age < 1 || age > 21) continue;
          const base = allowed.get(item.dateKey)?.get(item.exerciseId);
          if (!base) continue;
          const adj: CoachAdjustment = { dateKey: item.dateKey, exerciseId: item.exerciseId, reason: item.reason.slice(0, 400), updatedAt: new Date().toISOString() };
          if (base.kind === 'endurance' && item.exerciseId === '__session__') {
            if (Number.isInteger(item.sessionDurationMinutes) && base.sessionDurationMinutes !== undefined && item.sessionDurationMinutes >= Math.max(20, Math.floor((base.baseDurationMinutes ?? base.sessionDurationMinutes) * 0.5)) && item.sessionDurationMinutes <= (base.maxDurationMinutes ?? base.sessionDurationMinutes)) adj.sessionDurationMinutes = item.sessionDurationMinutes;
            if (item.sessionIntensity === 'easy' || item.sessionIntensity === 'moderate') adj.sessionIntensity = item.sessionIntensity;
          } else if (base.kind === 'strength') {
            if (typeof item.weightKg === 'number' && Number.isFinite(item.weightKg) && base.weightKg !== undefined && item.weightKg >= base.weightKg * 0.8 && item.weightKg <= base.weightKg * 1.05) adj.weightKg = Math.round(item.weightKg * 10) / 10;
            if (Number.isInteger(item.sets) && item.sets >= 1 && item.sets <= base.sets) adj.sets = item.sets;
            if (typeof item.reps === 'string' && /^\d{1,2}(?:[–-]\d{1,2})?$/.test(item.reps)) { const repParts = item.reps.split(/[–-]/).map(Number); if (repParts.every(value => Number.isInteger(value) && value >= 1 && value <= 30) && (repParts.length === 1 || repParts[0] <= repParts[1])) adj.reps = item.reps; }
            if (Number.isInteger(item.restSeconds) && item.restSeconds >= 30 && item.restSeconds <= 300) adj.restSeconds = item.restSeconds;
          }
          if (adj.weightKg !== undefined || adj.sets !== undefined || adj.reps !== undefined || adj.restSeconds !== undefined || adj.sessionDurationMinutes !== undefined || adj.sessionIntensity !== undefined) validAdjustments.push(adj);
        }
      }
      const reportToSave = autoApply && validAdjustments.length
        ? `AUTOAJUSTE: ${validAdjustments.length} cambios validados aplicados a fechas futuras.\n\n${report}`
        : autoApply ? `AUTOAJUSTE: análisis completado, sin cambios válidos que aplicar.\n\n${report}` : report;
      setData(current => { const appliedAdjustments = { ...(current.planAdjustments ?? {}) }; if (autoApply) for (const adjustment of validAdjustments) appliedAdjustments[adjustmentKey(adjustment.dateKey, adjustment.exerciseId)] = adjustment; return { ...current, coachReport: reportToSave, coachLastUpdatedAt: new Date().toISOString(), pendingCoachAdjustments: autoApply ? [] : validAdjustments, planAdjustments: autoApply ? appliedAdjustments : current.planAdjustments }; });
      if (!automatic) showInfo(autoApply ? 'Autoajuste IA completado' : 'Análisis IA completado', autoApply ? (validAdjustments.length ? `${validAdjustments.length} ajustes validados se han aplicado a entrenamientos futuros. El historial permanece intacto.` : 'Análisis completado. No había cambios válidos que aplicar; el plan sigue con la progresión local.') : (validAdjustments.length ? `La IA ha preparado ${validAdjustments.length} propuestas para fechas futuras. Revísalas y aplícalas desde Progreso; no se ha modificado el historial.` : 'La IA ha actualizado su análisis. No hay cambios de entrenamiento válidos para aplicar en las próximas tres semanas.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      if (automatic) setData(current => ({ ...current, coachReport: `El autoajuste IA no se completó: ${message}. El motor local sigue adaptando el plan con tus registros y recuperación.` }));
      else showInfo('No se pudo completar el análisis IA', `${message}\n\nEl entrenador automático local sigue funcionando con tus registros y métricas de recuperación.`);
    } finally { setCoachBusy(false); }
  };

  const pickRecoveryScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 850 } }],
        { compress: 0.48, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!compressed.base64) {
        showInfo('No se ha podido guardar la captura', 'Vuelve a seleccionar la imagen o introduce las métricas manualmente.');
        return;
      }
      const dataUri = `data:image/jpeg;base64,${compressed.base64}`;
      if (dataUri.length > 380000) {
        showInfo('Captura demasiado grande', 'Selecciona una captura más pequeña o recórtala antes de importarla. Para mantener el almacenamiento local estable, el límite es de aproximadamente 280 KB.');
        return;
      }
      setRecoveryImage(dataUri);
      setRemoveRecoveryImage(false);
    } catch (error) {
      showInfo('No se pudo abrir la captura', 'Puedes volver a intentarlo o registrar las métricas manualmente.');
    }
  };

  const editRecoveryEntry = (entry: RecoveryEntry) => {
    setRecoveryEditingId(entry.id);
    setRecoveryDraft({
      dateKey: entry.dateKey,
      sleepHours: entry.sleepHours === undefined ? '' : String(entry.sleepHours),
      sleepScore: entry.sleepScore === undefined ? '' : String(entry.sleepScore),
      hrvMs: entry.hrvMs === undefined ? '' : String(entry.hrvMs),
      restingHrBpm: entry.restingHrBpm === undefined ? '' : String(entry.restingHrBpm),
      bodyBattery: entry.bodyBattery === undefined ? '' : String(entry.bodyBattery),
      stressScore: entry.stressScore === undefined ? '' : String(entry.stressScore),
      energyScore: entry.energyScore === undefined ? '' : String(entry.energyScore),
      notes: entry.notes ?? '',
    });
    setRecoveryImage(entry.imageDataUri);
    setRemoveRecoveryImage(false);
    setTab('recuperacion');
    setRecoveryEditingId(entry.id);
  };

  const saveRecovery = () => {
    const fields: [keyof RecoveryDraft, string, number, number][] = [
      ['sleepHours', 'Horas de sueño', 0, 24], ['sleepScore', 'Puntuación de sueño', 0, 100], ['hrvMs', 'VFC (ms)', 1, 300],
      ['restingHrBpm', 'Pulso en reposo', 20, 240], ['bodyBattery', 'Body Battery', 0, 100], ['stressScore', 'Estrés', 0, 100], ['energyScore', 'Energía percibida', 1, 10],
    ];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recoveryDraft.dateKey) || Number.isNaN(parseDateKey(recoveryDraft.dateKey).getTime()) || dateKey(parseDateKey(recoveryDraft.dateKey)) !== recoveryDraft.dateKey) {
      showInfo('Revisa la fecha', 'Introduce una fecha válida en formato AAAA-MM-DD.'); return;
    }
    const parsed: Record<string, number | undefined> = {};
    for (const [key, label, min, max] of fields) {
      const raw = recoveryDraft[key] as string;
      const value = raw.trim() ? safeNum(raw) : undefined;
      if (raw.trim() && (value === undefined || value < min || value > max)) { showInfo('Revisa los datos', `${label}: introduce un valor entre ${min} y ${max}.`); return; }
      parsed[key] = value;
    }
    if (Object.values(parsed).every(value => value === undefined) && !recoveryImage && !recoveryDraft.notes.trim()) {
      showInfo('Faltan datos', 'Adjunta una captura de Garmin Connect o introduce alguna métrica de recuperación.'); return;
    }
    const previousEntry = recoveryEditingId ? (data.recoveryEntries ?? []).find(item => item.id === recoveryEditingId) : undefined;
    const draftEntry = {
      id: previousEntry?.id ?? makeId(), dateKey: recoveryDraft.dateKey,
      createdAt: previousEntry?.createdAt ?? new Date().toISOString(),
      sleepHours: parsed.sleepHours, sleepScore: parsed.sleepScore, hrvMs: parsed.hrvMs, restingHrBpm: parsed.restingHrBpm,
      bodyBattery: parsed.bodyBattery, stressScore: parsed.stressScore, energyScore: parsed.energyScore,
      notes: recoveryDraft.notes.trim() || undefined, imageDataUri: removeRecoveryImage ? undefined : (recoveryImage ?? previousEntry?.imageDataUri),
    };
    const priorEntries = (data.recoveryEntries ?? []).filter(entry => entry.id !== draftEntry.id && entry.dateKey < draftEntry.dateKey);
    const assessment = readinessAssessment(draftEntry, priorEntries);
    const entry: RecoveryEntry = { ...draftEntry, readiness: assessment.status, recommendation: assessment.recommendation };
    setData(current => ({ ...current, recoveryEntries: previousEntry ? current.recoveryEntries.map(item => item.id === entry.id ? entry : item).sort((a,b) => a.dateKey.localeCompare(b.dateKey)) : [...(current.recoveryEntries ?? []), entry].sort((a,b) => a.dateKey.localeCompare(b.dateKey)) }));
    const wasEditing = Boolean(previousEntry);
    setRecoveryDraft({ dateKey: dateKey(new Date()), sleepHours: '', sleepScore: '', hrvMs: '', restingHrBpm: '', bodyBattery: '', stressScore: '', energyScore: '', notes: '' });
    setRecoveryImage(undefined); setRemoveRecoveryImage(false); setRecoveryEditingId(null);
    showInfo(wasEditing ? 'Recuperación actualizada' : 'Recuperación guardada', assessment.recommendation);
    if (data.autoCoachEnabled) void runAiCoach({ automatic: true, forceAutoApply: true, extraRecovery: entry });
  };

  const deleteRecoveryEntry = (entry: RecoveryEntry) => {
    showConfirm({ title: 'Eliminar registro de recuperación', message: `Se eliminará el registro del ${entry.dateKey} y su captura, si la había.`, confirmLabel: 'ELIMINAR REGISTRO', destructive: true, onConfirm: () => setData(current => ({ ...current, recoveryEntries: current.recoveryEntries.filter(item => item.id !== entry.id) })) });
  };

  const enableReminders = async () => {
    try {
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
      if (!permission.granted) { showInfo('Notificaciones desactivadas', 'Actívalas en Ajustes del iPhone para recibir recordatorios.'); return; }
      for (const id of data.reminderIds) { try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ } }
      const now = new Date();
      const ids: string[] = [];
      const times: Record<number, string> = { 0: '08:00', 1: '16:00', 2: '16:00', 4: '11:30', 5: '12:45', 6: '08:00' };
      // Programamos las próximas dos semanas; los recordatorios se pueden renovar al abrir la app.
      for (let offset = 0; offset < 14; offset++) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate()+offset);
        const time = times[date.getDay()];
        if (!time) continue;
        const [hh, mm] = time.split(':').map(Number);
        const workoutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
        const reminderTime = new Date(workoutTime.getTime() - 30*60*1000);
        if (reminderTime <= now) continue;
        const plan = getUserPlan(date.getDay(), dateKey(date), data);
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: 'Tu entrenamiento es en 30 minutos', body: `${plan.title} · ${time}`, sound: true, data: { screen: 'plan', date: dateKey(date) } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
        });
        ids.push(id);
      }
      setData(current => ({ ...current, reminderEnabled: true, reminderIds: ids }));
      showInfo('Recordatorios activados', 'He programado los avisos de las próximas dos semanas. Vuelve a abrir la app periódicamente para renovar la programación.');
    } catch (err) {
      showInfo('No se pudieron activar', 'Revisa los permisos de notificaciones del iPhone e inténtalo de nuevo.');
    }
  };
  const disableReminders = async () => {
    for (const id of data.reminderIds) { try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ } }
    setData(current => ({ ...current, reminderEnabled: false, reminderIds: [] }));
  };

  const saveProfile = () => {
    const age = Number(profileDraft.age);
    const height = Number(profileDraft.heightCm.replace(',', '.'));
    const weight = Number(profileDraft.currentWeightKg.replace(',', '.'));
    if ((profileDraft.age && (!Number.isFinite(age) || age < 1 || age > 120)) || (profileDraft.heightCm && (!Number.isFinite(height) || height < 1)) || (profileDraft.currentWeightKg && (!Number.isFinite(weight) || weight < 1))) {
      showInfo('Revisa los datos', 'Comprueba edad, altura y peso antes de guardar.'); return;
    }
    setData(current => ({ ...current, profile: { ...profileDraft } }));
    setMeasurementDraft(current => ({ ...current, weightKg: profileDraft.currentWeightKg }));
    showInfo('Perfil guardado', 'Los datos se han guardado en este dispositivo.');
  };

  const saveMeasurement = () => {
    const weight = safeNum(measurementDraft.weightKg);
    const bodyFat = safeNum(measurementDraft.bodyFatPercent);
    const waist = safeNum(measurementDraft.waistCm);
    const arm = safeNum(measurementDraft.armCm);
    const chest = safeNum(measurementDraft.chestCm);
    if (weight === undefined || weight <= 0) { showInfo('Falta el peso', 'Introduce tu peso actual en kg.'); return; }
    if (bodyFat !== undefined && (bodyFat < 0 || bodyFat > 70)) { showInfo('Revisa el porcentaje', 'Introduce un porcentaje de grasa entre 0 y 70.'); return; }
    if ([waist,arm,chest].some(v => v !== undefined && v <= 0)) { showInfo('Revisa las medidas', 'Los perímetros deben ser valores positivos.'); return; }
    const entry: BodyMeasurement = { id: makeId(), dateKey: dateKey(new Date()), weightKg: weight, bodyFatPercent: bodyFat, waistCm: waist, armCm: arm, chestCm: chest, source: 'usuario' };
    setData(current => ({ ...current, profile: { ...current.profile, currentWeightKg: String(weight) }, bodyMeasurements: [...current.bodyMeasurements, entry].sort((a,b)=>a.dateKey.localeCompare(b.dateKey)) }));
    setProfileDraft(current => ({ ...current, currentWeightKg: String(weight) }));
    showInfo('Medición guardada', 'La medición se ha añadido al historial corporal.');
  };

  const postCoachApi = async (payload: Record<string, unknown>) => {
    const endpoint = coachEndpoint.trim() || (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/.netlify/functions/coach-ai` : '');
    const token = await getAiAuthToken();
    if (!endpoint) throw new Error('Falta configurar EXPO_PUBLIC_COACH_API_URL o abrir la aplicación desde el dominio de Netlify.');
    if (!token) throw new Error('Inicia sesión con tu cuenta o configura el código de acceso del entrenador en Progreso.');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({} as any));
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `La función IA respondió ${response.status}.`);
    return body;
  };

  const completeOnboarding = async () => {
    const age = safeNum(onboardingAnswers.age);
    const height = safeNum(onboardingAnswers.heightCm);
    const weight = safeNum(onboardingAnswers.currentWeightKg);
    if (age !== undefined && (age < 13 || age > 100)) { setOnboardingMessage('Revisa la edad: introduce un valor entre 13 y 100.'); return; }
    if (height !== undefined && (height < 100 || height > 230)) { setOnboardingMessage('Revisa la altura en centímetros.'); return; }
    if (weight !== undefined && (weight < 30 || weight > 300)) { setOnboardingMessage('Revisa el peso en kg.'); return; }
    if (!onboardingAnswers.primaryGoal || !onboardingAnswers.trainingDays) { setOnboardingMessage('Completa el objetivo principal y los días disponibles.'); return; }
    setOnboardingBusy(true); setOnboardingMessage('Preparando una planificación adaptada a tus respuestas…');
    let program = fallbackProgramFromAnswers(onboardingAnswers);
    let generationLabel = 'Plan inicial local generado; cuando la IA esté configurada podrá afinarlo.';
    try {
      const result = await postCoachApi({ mode: 'generate_plan', questionnaire: onboardingAnswers, profile: { name: authUsername || String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? ''), age, heightCm: height, currentWeightKg: weight }, history: [], recovery: [] });
      if (Array.isArray(result.program)) { program = normalizeProgram(result.program, program); generationLabel = 'Plan inicial generado por IA. Revisa las cargas y limita cualquier ejercicio que no sea adecuado.'; }
    } catch (error) {
      generationLabel = `Se creó una base de planificación local. La IA no pudo generar el plan ahora: ${error instanceof Error ? error.message : 'error de conexión'}`;
    }
    const username = authUsername.trim() || String(authUser?.user_metadata?.display_name ?? authUser?.user_metadata?.username ?? authUser?.email?.split('@')[0] ?? data.profile.name);
    const nextProfile: Profile = { ...data.profile, name: username, age: onboardingAnswers.age, heightCm: onboardingAnswers.heightCm, currentWeightKg: onboardingAnswers.currentWeightKg, notes: [data.profile.notes, `Objetivo: ${onboardingAnswers.primaryGoal}. Experiencia: ${onboardingAnswers.experience}. Prioridad: ${onboardingAnswers.priority}. Limitaciones declaradas: ${onboardingAnswers.limitations}.`].filter(Boolean).join('\n') };
    const updated: AppData = { ...data, profile: nextProfile, customProgram: program, programStartDate: dateKey(new Date()), onboarding: { completed: true, answers: { ...onboardingAnswers }, completedAt: new Date().toISOString() }, coachReport: generationLabel, coachLastUpdatedAt: new Date().toISOString() };
    setData(updated); setProfileDraft(nextProfile); setMeasurementDraft(current => ({ ...current, weightKg: nextProfile.currentWeightKg })); setTab('inicio'); setOnboardingMessage(generationLabel); setOnboardingBusy(false);
  };

  const sendChatMessage = async (preset?: string) => {
    const content = (preset ?? chatDraft).trim();
    if (!content || chatSending) return;
    const userMessage: ChatMessage = { id: makeId(), role: 'user', content: content.slice(0, 2500), createdAt: new Date().toISOString() };
    const previous = data.chatMessages ?? [];
    const messages = [...previous, userMessage].slice(-30);
    setData(current => ({ ...current, chatMessages: messages }));
    setChatDraft(''); setChatSending(true);
    try {
      const todayKey = dateKey(new Date());
      const upcomingSessions = Array.from({ length: 21 }, (_, index) => {
        const dayDate = new Date(); dayDate.setDate(dayDate.getDate() + index + 1);
        const key = dateKey(dayDate); const plan = getAdaptivePlan(dayDate.getDay(), key, data);
        const exercises = plan.kind === 'strength' ? plan.exercises.map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, weightKg: e.weightKg, restSeconds: e.restSeconds, group: e.group })) : plan.kind === 'endurance' ? [{ id: '__session__', name: plan.title, sets: 1, reps: '1', weightKg: undefined, restSeconds: 60, sessionDurationMinutes: durationMinutesFromLabel(plan.duration), sessionIntensity: 'moderate' }] : [];
        return { dateKey: key, title: plan.title, kind: plan.kind, plannedDurationMinutes: durationMinutesFromLabel(getUserPlan(dayDate.getDay(), key, data).duration), recommendedDurationMinutes: durationMinutesFromLabel(plan.duration), exercises };
      }).filter(item => item.exercises.length > 0);
      const result = await postCoachApi({
        mode: 'chat', dateKey: todayKey,
        messages: messages.slice(-16).map(item => ({ role: item.role, content: item.content })),
        profile: data.profile,
        questionnaire: data.onboarding?.answers,
        currentSession: data.activeSession ? { title: activePlan?.title, dateKey: data.activeSession.dateKey, sets: allLogs(data.activeSession), startedAt: data.activeSession.startedAt } : null,
        recentSessions: data.history.filter(s => s.status !== 'abandoned').slice(0, 12).map(s => ({ dateKey: s.dateKey, title: s.title, durationMinutes: Math.round(s.durationSeconds/60), feedback: s.feedback, sets: s.sets.slice(0, 60) })),
        recovery: [...(data.recoveryEntries ?? [])].slice(-14).map(r => ({ dateKey: r.dateKey, sleepHours: r.sleepHours, sleepScore: r.sleepScore, hrvMs: r.hrvMs, restingHrBpm: r.restingHrBpm, bodyBattery: r.bodyBattery, stressScore: r.stressScore, energyScore: r.energyScore, readiness: r.readiness, recommendation: r.recommendation, notes: r.notes })),
        upcomingSessions,
      });
      const reply = typeof result.reply === 'string' ? result.reply : typeof result.report === 'string' ? result.report : 'No se recibió una respuesta de texto. Vuelve a intentarlo.';
      const assistantMessage: ChatMessage = { id: makeId(), role: 'assistant', content: reply.slice(0, 10000), createdAt: new Date().toISOString() };
      setData(current => {
        let pending = current.pendingCoachAdjustments ?? [];
        if (Array.isArray(result.adjustments)) {
          const allowed = new Map<string, any>();
          upcomingSessions.forEach(day => day.exercises.forEach((ex: any) => allowed.set(`${day.dateKey}::${ex.id}`, ex)));
          const safe = result.adjustments.slice(0, 20).flatMap((item: any) => {
            if (!item || typeof item.dateKey !== 'string' || typeof item.exerciseId !== 'string' || typeof item.reason !== 'string') return [];
            const base = allowed.get(`${item.dateKey}::${item.exerciseId}`);
            const distance = utcDayNumber(item.dateKey) - utcDayNumber(todayKey);
            if (!base || distance < 1 || distance > 21) return [];
            const adj: CoachAdjustment = { dateKey: item.dateKey, exerciseId: item.exerciseId, reason: item.reason.slice(0, 400), updatedAt: new Date().toISOString() };
            if (base.weightKg !== undefined && typeof item.weightKg === 'number' && item.weightKg >= base.weightKg * 0.8 && item.weightKg <= base.weightKg * 1.05) adj.weightKg = Math.round(item.weightKg*10)/10;
            if (Number.isInteger(item.sets) && item.sets >= 1 && item.sets <= base.sets) adj.sets = item.sets;
            if (typeof item.reps === 'string' && /^\d{1,2}(?:[–-]\d{1,2})?$/.test(item.reps)) adj.reps = item.reps;
            if (Number.isInteger(item.restSeconds) && item.restSeconds >= 30 && item.restSeconds <= 300) adj.restSeconds = item.restSeconds;
            if (base.id === '__session__' && Number.isInteger(item.sessionDurationMinutes) && item.sessionDurationMinutes >= 20 && item.sessionDurationMinutes <= (base.sessionDurationMinutes ?? 300)) adj.sessionDurationMinutes = item.sessionDurationMinutes;
            if (base.id === '__session__' && ['easy','moderate'].includes(item.sessionIntensity)) adj.sessionIntensity = item.sessionIntensity;
            return adj.weightKg !== undefined || adj.sets !== undefined || adj.reps !== undefined || adj.restSeconds !== undefined || adj.sessionDurationMinutes !== undefined || adj.sessionIntensity !== undefined ? [adj] : [];
          });
          if (safe.length) pending = [...pending, ...safe].slice(-30);
        }
        return { ...current, chatMessages: [...(current.chatMessages ?? []).filter(m => m.id !== userMessage.id), userMessage, assistantMessage].slice(-100), pendingCoachAdjustments: pending };
      });
    } catch (error) {
      const assistantMessage: ChatMessage = { id: makeId(), role: 'assistant', content: `No he podido conectar ahora mismo con el entrenador IA. ${error instanceof Error ? error.message : 'Comprueba la configuración de conexión.'} Tus datos siguen guardados y el ajuste local continúa funcionando.`, createdAt: new Date().toISOString() };
      setData(current => ({ ...current, chatMessages: [...(current.chatMessages ?? []).filter(m => m.id !== userMessage.id), userMessage, assistantMessage].slice(-100) }));
    } finally { setChatSending(false); }
  };

  const importTrainingPdf = async () => {
    setPdfImportMessage(''); setPdfImportBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, base64: Platform.OS === 'web' });
      if (result.canceled || !result.assets?.[0]) { setPdfImportBusy(false); return; }
      const file = result.assets[0];
      const base64 = (file as any).base64 || await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      if (typeof base64 !== 'string' || base64.length < 100) throw new Error('No he podido leer el PDF. Inténtalo de nuevo desde Archivos.');
      if (base64.length > 4_500_000) throw new Error('El PDF supera el límite de 3,2 MB. Guarda una versión más ligera y vuelve a intentarlo.');
      const resultJson = await postCoachApi({ mode: 'import_pdf', filename: file.name, pdfBase64: base64, profile: data.profile, questionnaire: data.onboarding?.answers });
      const fallback = data.customProgram ?? weeklyPlan;
      let program = data.customProgram;
      const importedWeeklyProgram = Array.isArray(resultJson.program) && resultJson.program.length > 0;
      if (importedWeeklyProgram) program = normalizeProgram(resultJson.program, fallback);
      const datedPlans: Record<string, DayPlan> = { ...(data.scheduledPlans ?? {}) };
      let importedDatedCount = 0;
      if (Array.isArray(resultJson.scheduledSessions)) {
        resultJson.scheduledSessions.slice(0, 180).forEach((item: any) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.dateKey ?? '') || !item?.plan) return;
          const date = parseDateKey(item.dateKey);
          const one = normalizeProgram([{ ...item.plan, day: date.getDay() }], [getUserPlan(date.getDay(), item.dateKey, data)])[0];
          datedPlans[item.dateKey] = { ...one, day: date.getDay() };
          importedDatedCount += 1;
        });
      }
      if (!importedWeeklyProgram && importedDatedCount === 0) throw new Error('El PDF no contiene una planificación que pueda convertir en sesiones. Prueba con un PDF de texto legible y con fechas, días o ejercicios claros.');
      setData(current => ({ ...current, customProgram: program, scheduledPlans: datedPlans, importedPlanName: file.name }));
      setPdfImportMessage(`Importación preparada: ${typeof resultJson.summary === 'string' ? resultJson.summary : ''} ${Array.isArray(resultJson.scheduledSessions) ? resultJson.scheduledSessions.length + ' sesiones con fecha.' : ''} ${program ? 'Se actualizó la programación semanal.' : ''} Revisa el calendario antes de empezar.`);
    } catch (error) {
      setPdfImportMessage(error instanceof Error ? error.message : 'No se ha podido importar el PDF.');
    } finally { setPdfImportBusy(false); }
  };

  const changeMonth = (delta: number) => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth()+delta, 1));
  const calendarCells = useMemo(() => {
    const first = startOfMonth(calendarMonth);
    const offset = (first.getDay()+6)%7;
    const days = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_,i) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i+1))];
  }, [calendarMonth]);

  if (supabaseConfigured && !authReady) return <SafeAreaView style={styles.loading}><ExpoStatusBar style="light"/><Text style={styles.brand}>MY TRAINING LAB</Text><Text style={styles.muted}>Comprobando tu cuenta…</Text></SafeAreaView>;
  if (supabaseConfigured && authReady && !authUser) return <SafeAreaView style={styles.safe}><ExpoStatusBar style="light"/><ScrollView contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:24 }} keyboardShouldPersistTaps="handled"><View style={styles.brandMark}><Text style={styles.brandMarkText}>MT</Text></View><Text style={[styles.eyebrow,{marginTop:22}]}>MY TRAINING LAB · CUENTA PERSONAL</Text><Text style={styles.h1}>{authMode === 'signup' ? 'Crea tu perfil.' : 'Bienvenido de nuevo.'}</Text><Text style={[styles.muted,{lineHeight:21,marginBottom:18}]}>{authMode === 'signup' ? 'Crea tu cuenta para guardar tu entrenamiento, recuperación e historial de forma privada y tenerlos sincronizados entre dispositivos.' : 'Inicia sesión para acceder a tu planificación personal.'}</Text>{authMode === 'signup' ? <><Text style={styles.fieldLabel}>NOMBRE DE USUARIO</Text><TextInput value={authUsername} onChangeText={setAuthUsername} autoCapitalize="none" style={styles.input} placeholder="Ej. montreino" placeholderTextColor={C.muted}/></> : null}<Text style={styles.fieldLabel}>{authMode === 'signup' ? 'CORREO ELECTRÓNICO (VERIFICACIÓN Y RECUPERACIÓN)' : 'CORREO ELECTRÓNICO O NOMBRE DE USUARIO'}</Text><TextInput value={authEmail} onChangeText={setAuthEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder={authMode === 'signup' ? 'tu@email.com' : 'tu@email.com o usuario'} placeholderTextColor={C.muted}/><Text style={styles.fieldLabel}>CONTRASEÑA (MÍNIMO 8 CARACTERES)</Text><TextInput value={authPassword} onChangeText={setAuthPassword} autoCapitalize="none" secureTextEntry style={styles.input} placeholder="Contraseña segura" placeholderTextColor={C.muted}/>{authMessage ? <View style={styles.dataNote}><Text style={styles.mutedSmall}>{authMessage}</Text></View> : null}<Pressable disabled={authBusy} style={[styles.primaryButton,authBusy&&{opacity:.6}]} onPress={() => void handleAuthSubmit()}><Text style={styles.primaryButtonText}>{authBusy ? 'PROCESANDO…' : authMode === 'signup' ? 'CREAR CUENTA' : 'INICIAR SESIÓN'}</Text></Pressable><Pressable style={[styles.secondaryButton,{marginTop:12}]} onPress={() => { setAuthMode(v => v === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}><Text style={styles.secondaryButtonText}>{authMode === 'signup' ? 'YA TENGO UNA CUENTA · INICIAR SESIÓN' : 'CREAR UN PERFIL NUEVO'}</Text></Pressable>{authMode === 'login' ? <Pressable style={{alignSelf:'center',padding:12}} onPress={()=>void handlePasswordReset()}><Text style={[styles.mutedTiny,{color:C.accent}]}>HE OLVIDADO MI CONTRASEÑA</Text></Pressable> : null}<Text style={[styles.mutedTiny,{marginTop:14,lineHeight:15}]}>Tus datos se guardan en una cuenta privada. El propietario de la aplicación debe configurar Supabase y ejecutar supabase/schema.sql antes de habilitar el registro público.</Text></ScrollView></SafeAreaView>;
  if (supabaseConfigured && authUser && !loaded) return <SafeAreaView style={styles.loading}><ExpoStatusBar style="light"/><Text style={styles.brand}>MY TRAINING LAB</Text><Text style={styles.muted}>Cargando tu perfil privado…</Text></SafeAreaView>;
  if (supabaseConfigured && authUser && loaded && !data.onboarding?.completed) {
    const question = ONBOARDING_QUESTIONS[onboardingStep];
    const currentAnswer = onboardingAnswers[question.key] ?? '';
    const setAnswer = (value: string) => setOnboardingAnswers(current => ({ ...current, [question.key]: value }));
    return <SafeAreaView style={styles.safe}><ExpoStatusBar style="light"/><ScrollView contentContainerStyle={{flexGrow:1,padding:22,justifyContent:'center'}} keyboardShouldPersistTaps="handled"><View style={styles.brandMark}><Text style={styles.brandMarkText}>MT</Text></View><Text style={[styles.eyebrow,{marginTop:20}]}>CONFIGURA TU ENTRENADOR · {onboardingStep+1} DE {ONBOARDING_QUESTIONS.length}</Text><View style={styles.blockTrack}><View style={[styles.blockFill,{width:`${((onboardingStep+1)/ONBOARDING_QUESTIONS.length)*100}%`}]} /></View><Text style={[styles.h1,{marginTop:18}]}>{question.title}</Text><Text style={[styles.muted,{lineHeight:21,marginBottom:20}]}>{question.help}</Text>{question.type === 'choice' ? <View style={{gap:8}}>{(question.options ?? []).map(option => <Pressable key={option} onPress={() => setAnswer(option)} style={[styles.navMenuOption,{backgroundColor:currentAnswer===option?'rgba(200,255,66,.09)':C.surface,borderColor:currentAnswer===option?C.accent:C.border}]}><Text style={{flex:1,color:currentAnswer===option?C.accent:C.text,fontSize:13,fontWeight:'800'}}>{option}</Text><Text style={{color:C.accent,fontWeight:'900'}}>{currentAnswer===option?'✓':'○'}</Text></Pressable>)}</View> : <TextInput value={currentAnswer} onChangeText={setAnswer} keyboardType={question.type === 'number' ? 'decimal-pad' : 'default'} style={[styles.input,{minHeight:question.type==='text'?110:50,textAlignVertical:question.type==='text'?'top':'center'}]} multiline={question.type==='text'} placeholder={question.type==='number'?'Introduce un valor (opcional)':'Escribe tu respuesta…'} placeholderTextColor={C.muted}/>}{onboardingMessage ? <View style={styles.dataNote}><Text style={styles.mutedSmall}>{onboardingMessage}</Text></View> : null}<View style={{flexDirection:'row',gap:9,marginTop:22}}>{onboardingStep>0 ? <Pressable style={[styles.cancelButton,{flex:1}]} onPress={()=>{setOnboardingStep(step=>Math.max(0,step-1));setOnboardingMessage('');}}><Text style={styles.cancelText}>ANTERIOR</Text></Pressable> : null}<Pressable disabled={onboardingBusy} style={[styles.finishButton,{flex:2,backgroundColor:C.accent},onboardingBusy&&{opacity:.6}]} onPress={()=>{setOnboardingMessage('');if(onboardingStep<ONBOARDING_QUESTIONS.length-1){setOnboardingStep(step=>step+1);}else{void completeOnboarding();}}}><Text style={[styles.finishText,{color:C.bg}]}>{onboardingBusy?'GENERANDO…':onboardingStep===ONBOARDING_QUESTIONS.length-1?'GENERAR MI PLAN':'CONTINUAR'}</Text></Pressable></View><Pressable onPress={()=>void handleSignOut()} style={{alignSelf:'center',marginTop:18,padding:10}}><Text style={styles.mutedTiny}>Cerrar sesión</Text></Pressable><Text style={[styles.mutedTiny,{marginTop:9,lineHeight:15}]}>Son 15 preguntas como máximo. Las respuestas se usan para generar una propuesta inicial; revisa ejercicios, cargas y limitaciones antes de entrenar.</Text></ScrollView></SafeAreaView>;
  }
  if (!loaded) return <SafeAreaView style={styles.loading}><ExpoStatusBar style="light"/><Text style={styles.brand}>MY TRAINING LAB</Text><Text style={styles.muted}>Cargando tu planificación…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="light" />
      <View style={styles.topBar}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>MT</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.brand}>MY TRAINING LAB</Text><Text style={styles.brandSub}>TU PROGRESO, CON DATOS REALES</Text></View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir menú de navegación"
          style={styles.navMenuTrigger}
          onPress={() => setNavMenuOpen(true)}
        >
          <Text style={styles.navMenuTriggerIcon}>☰</Text>
          <Text style={styles.navMenuTriggerText}>MENÚ</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {tab === 'inicio' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPad}>
          <Text style={styles.eyebrow}>{prettyDate(today).toUpperCase()}</Text>
          <Text style={styles.h1}>Vamos a entrenar{data.profile.name ? `, ${data.profile.name}` : ''}.</Text>
          <Text style={styles.muted}>Tu plan personal, en un solo lugar.</Text>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}><View style={styles.pill}><Text style={styles.pillText}>ENTRENAMIENTO DE HOY</Text></View><Text style={styles.heroTime}>{todayPlan.time ?? 'A TU RITMO'}</Text></View>
            <Text style={styles.heroTitle}>{todayPlan.title}</Text>
            <Text style={styles.heroSub}>{todayPlan.subtitle}</Text>
            <View style={styles.rowMeta}><Text style={styles.metaText}>{todayPlan.duration ?? `${todayPlan.exercises.length} ejercicios`}</Text><Text style={styles.metaText}>{todayPlan.kind === 'strength' ? `${todayPlan.exercises.length} ejercicios` : todayPlan.kind === 'endurance' ? 'Actividad exterior' : 'Recuperación'}</Text></View>
            <View style={styles.heroRule}/>
            <Text style={styles.mutedSmall}>{todayPlan.note ?? 'Sesión programada según tu planificación semanal.'}</Text>
            <Pressable style={styles.primaryButton} onPress={() => data.activeSession ? setTab('sesion') : startSession(todayPlan, today)}><Text style={styles.primaryButtonText}>{data.activeSession ? 'VOLVER A LA SESIÓN' : todayPlan.kind === 'endurance' ? 'REGISTRAR ACTIVIDAD' : 'EMPEZAR ENTRENAMIENTO'} <Text style={styles.arrow}>↗</Text></Text></Pressable>
          </View>
          <View style={styles.statRow}>
            <StatCard label="PESO ACTUAL" value={data.profile.currentWeightKg ? `${data.profile.currentWeightKg.replace('.', ',')} kg` : '—'} footer="Último dato registrado" />
            <StatCard label="OBJETIVO" value={data.profile.goalWeightKg ? `${data.profile.goalWeightKg.replace('.', ',')} kg` : '—'} footer="Peso objetivo declarado" />
          </View>
          <View style={styles.coachCard}><Text style={styles.eyebrow}>RECUPERACIÓN Y PROGRESO</Text><Text style={styles.cardTitle}>Tu recomendación contextual</Text><Text style={[styles.mutedSmall,{lineHeight:18,marginTop:6}]}>{recoveryInsights.fatigue}{recoveryInsights.sleepAvg !== undefined ? ` Sueño medio registrado: ${recoveryInsights.sleepAvg.toLocaleString('es-ES',{maximumFractionDigits:1})} h.` : ' Registra tu sueño para que el análisis sea más personal.'}</Text><Pressable style={[styles.secondaryButton,{marginTop:10}]} onPress={()=>{setChatDraft('Analiza mi sueño, recuperación y fatiga recientes y dime si debo modificar el entrenamiento de hoy.');setTab('coach');}}><Text style={styles.secondaryButtonText}>HABLAR CON MI ENTRENADOR IA ↗</Text></Pressable></View>
          {data.activeSession && <Pressable style={styles.resumeCard} onPress={() => setTab('sesion')}><View style={styles.resumeIcon}><Text>▶</Text></View><View style={{flex:1}}><Text style={styles.cardTitle}>Sesión en curso</Text><Text style={styles.mutedSmall}>{activePlan?.title} · {loggedSets} series registradas</Text></View><Text style={styles.chevron}>›</Text></Pressable>}
          <SectionTitle title="TU SEMANA" action="Ver calendario" onAction={() => setTab('plan')} />
          <View style={styles.weekList}>{[1,2,3,4,5,6,0].map(day => { const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + ((day - today.getDay()+7)%7)); const p = getUserPlan(day, dateKey(nextDate), data); const todayMatch = today.getDay() === day; return <Pressable key={day} onPress={() => { const date = new Date(); date.setDate(date.getDate() + ((day - date.getDay()+7)%7)); setSelectedDate(dateKey(date)); setCalendarMonth(startOfMonth(date)); setTab('plan'); }} style={[styles.weekItem, todayMatch && styles.weekItemActive]}><View style={styles.dayBubble}><Text style={[styles.dayBubbleText, todayMatch && styles.dayBubbleTextActive]}>{dayShort[day]}</Text></View><View style={{flex:1}}><Text style={styles.weekTitle}>{p.title}</Text><Text style={styles.weekSub}>{p.subtitle}</Text></View><Text style={styles.weekTime}>{p.time ?? (p.kind === 'recovery' ? 'LIBRE' : '—')}</Text></Pressable>; })}</View>
          <Notice text="Las cargas y calorías importadas son propuestas cuando así se indica en tu ficha. Revisa las cargas iniciales antes de usarlas." />
        </ScrollView>}

        {tab === 'plan' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPad}>
          <Text style={styles.eyebrow}>PLANIFICACIÓN</Text><Text style={styles.h1}>Tu calendario.</Text><Text style={styles.muted}>Selecciona un día para ver la sesión asignada.</Text>
          <View style={styles.coachCard}><Text style={styles.sectionHeader}>IMPORTAR PLANIFICACIÓN EN PDF</Text><Text style={styles.mutedSmall}>Sube tu plan para extraer días, ejercicios, series, repeticiones, descansos y fechas cuando aparezcan en el documento. Se importará como borrador de calendario para que lo revises antes de entrenar.</Text><Pressable disabled={pdfImportBusy} style={[styles.primaryButton,pdfImportBusy&&{opacity:.6}]} onPress={() => void importTrainingPdf()}><Text style={styles.primaryButtonText}>{pdfImportBusy ? 'LEYENDO PDF…' : 'SUBIR PDF DE ENTRENAMIENTOS ↗'}</Text></Pressable>{data.importedPlanName ? <Text style={styles.mutedTiny}>Último archivo: {data.importedPlanName}</Text> : null}{pdfImportMessage ? <View style={styles.dataNote}><Text style={styles.mutedSmall}>{pdfImportMessage}</Text></View> : null}</View>
          <View style={styles.blockCard}><View style={styles.blockTop}><View style={{flex:1}}><Text style={styles.eyebrow}>PLAN CONTINUO · BLOQUES AUTOMÁTICOS</Text><Text style={styles.blockTitle}>{selectedBlock.started ? `Semana ${selectedBlock.week} de 8 · ${selectedBlock.phase}` : 'El bloque empieza con tu primera sesión de fuerza'}</Text></View><View style={styles.blockBadge}><Text style={styles.blockBadgeText}>{selectedBlock.started ? `CICLO ${selectedBlock.cycle}` : 'LISTO'}</Text></View></View><View style={styles.blockTrack}><View style={[styles.blockFill,{width:`${selectedBlock.started ? (selectedBlock.week/8)*100 : 12.5}%`}]} /></View><Text style={styles.mutedTiny}>El calendario genera sesiones cada semana. Semanas 1–3: acumulación; 4–5: intensificación; 6–7: consolidación; 8: descarga. Las cargas se adaptan al historial y el ciclo se repite automáticamente.</Text>{selectedReadiness.status !== 'sin-datos' && selectedReadiness.entry ? <Text style={[styles.recoveryInline,{color:selectedReadiness.status==='baja'?C.red:selectedReadiness.status==='moderada'?C.warning:C.green}]}>Recuperación reciente: {selectedReadiness.status==='baja'?'BAJA':selectedReadiness.status==='moderada'?'MODERADA':'BUENA'} · {selectedReadiness.entry.dateKey}</Text> : null}</View>
          <View style={styles.monthHeader}><Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>‹</Text></Pressable><Text style={styles.monthName}>{calendarMonth.toLocaleDateString('es-ES',{month:'long',year:'numeric'}).toUpperCase()}</Text><Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}><Text style={styles.monthArrowText}>›</Text></Pressable></View>
          <View style={styles.calendarGrid}>{['L','M','X','J','V','S','D'].map((d,i)=><Text key={i} style={styles.calendarWeekday}>{d}</Text>)}{calendarCells.map((date,index)=>date ? <Pressable key={dateKey(date)} onPress={() => setSelectedDate(dateKey(date))} style={[styles.calendarCell, selectedDate === dateKey(date) && styles.calendarCellSelected, dateKey(date) === dateKey(new Date()) && styles.calendarCellToday]}><Text style={[styles.calendarDayText, selectedDate === dateKey(date) && styles.calendarDayTextSelected]}>{date.getDate()}</Text><View style={[styles.calendarDot, getUserPlan(date.getDay(), dateKey(date), data).kind === 'strength' ? styles.dotStrength : getUserPlan(date.getDay(), dateKey(date), data).kind === 'endurance' ? styles.dotEndurance : styles.dotRecovery]} /></Pressable> : <View key={`blank-${index}`} style={styles.calendarCellEmpty}/> )}</View>
          <View style={styles.selectedDayCard}><View style={styles.selectedHeader}><View style={{flex:1}}><Text style={styles.eyebrow}>{prettyDate(chosenDate).toUpperCase()}</Text><Text style={styles.cardTitleLarge}>{selectedPlan.title}</Text><Text style={styles.mutedSmall}>{selectedPlan.subtitle}</Text></View><View style={styles.pill}><Text style={styles.pillText}>{selectedPlan.time ?? 'SIN HORA'}</Text></View></View>
            {selectedPlan.kind === 'strength' ? selectedPlan.exercises.map((exercise, i)=><ExerciseRow key={exercise.id} exercise={exercise} index={i} compact />) : <Text style={[styles.mutedSmall,{marginTop:14,lineHeight:20}]}>{selectedPlan.note}</Text>}
            {selectedPlan.kind !== 'rest' && <Pressable style={styles.primaryButton} onPress={() => startSession(selectedPlan, chosenDate)}><Text style={styles.primaryButtonText}>ABRIR ESTA SESIÓN ↗</Text></Pressable>}
          </View>
          <View style={styles.legendRow}><View style={[styles.legendDot,styles.dotStrength]}/><Text style={styles.mutedTiny}>Fuerza</Text><View style={[styles.legendDot,styles.dotEndurance]}/><Text style={styles.mutedTiny}>Exterior</Text><View style={[styles.legendDot,styles.dotRecovery]}/><Text style={styles.mutedTiny}>Recuperación</Text></View>
          <Notice text="La rutina semanal es la propuesta recogida en tu ficha. La fecha real de inicio del bloque todavía está pendiente de confirmar." />
        </ScrollView>}

        {tab === 'sesion' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPad}>
          {!data.activeSession ? <View style={styles.emptyState}><View style={styles.emptySymbol}><Text style={{fontSize:32}}>↗</Text></View><Text style={styles.h1}>Todo listo.</Text><Text style={[styles.muted,{textAlign:'center',lineHeight:22}]}>Inicia una sesión desde Inicio o Calendario. La app registrará cada serie y guardará el progreso en este dispositivo.</Text><Pressable onPress={() => setTab('plan')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>ELEGIR ENTRENAMIENTO</Text></Pressable></View> : <>
            <Text style={styles.eyebrow}>SESIÓN ACTIVA · {prettyDate(new Date(data.activeSession.startedAt)).toUpperCase()}</Text>
            <Text style={styles.h1}>{activePlan?.title}</Text>
            <View style={styles.sessionProgress}><View style={styles.progressLabelRow}><Text style={styles.mutedSmall}>PROGRESO</Text><Text style={styles.progressNum}>{activePlan?.kind === 'strength' ? `${progressPct}%` : 'EN CURSO'}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${activePlan?.kind === 'strength' ? progressPct : 35}%`}]} /></View><Text style={styles.mutedTiny}>{activePlan?.kind === 'strength' ? `${loggedSets} de ${plannedSets} series registradas` : `Inicio ${new Date(data.activeSession.startedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`}</Text></View>
            {activePlan?.kind === 'strength' && activeExercise ? <>
              <View style={styles.exerciseHero}><View style={styles.exerciseVisual}>{exerciseImageSource(activeExercise.id, activeExercise.name) ? <Image source={exerciseImageSource(activeExercise.id, activeExercise.name)} style={{width:'100%',height:155}} resizeMode="contain"/> : <View style={{alignItems:'center',justifyContent:'center',height:130}}><Text style={styles.dumbbellGlyph}>🏋️</Text><Text style={styles.visualSub}>Imagen específica pendiente de añadir</Text></View>}<Text style={styles.visualLabel}>GUÍA VISUAL DEL MOVIMIENTO</Text></View><View style={styles.exerciseHeroTitle}><Text style={styles.eyebrow}>EJERCICIO {data.activeSession.exerciseIndex+1} DE {activePlan.exercises.length}</Text><Text style={styles.cardTitleXL}>{activeExercise.name}</Text><Text style={styles.mutedSmall}>{activeExercise.group}</Text></View></View>
              {activeExercise.loadStatus === 'propuesta' && !activeExercise.adjustmentNote && <View style={styles.warningBanner}><Text style={styles.warningTitle}>CARGA PROPUESTA · REVISAR</Text><Text style={styles.warningText}>Peso inicial de la planificación; no consta como probado. Ajusta la carga si no corresponde a tu nivel actual.</Text></View>}
              {activeExercise.adjustmentNote && <View style={[styles.warningBanner,{borderColor:activeExercise.adjustmentNote.includes('recuperación baja')?'rgba(255,120,120,.35)':'rgba(200,255,66,.25)'}]}><Text style={[styles.warningTitle,{color:activeExercise.adjustmentNote.includes('recuperación baja')?C.red:C.accent}]}>AJUSTE DE PLANIFICACIÓN</Text><Text style={styles.warningText}>{activeExercise.adjustmentNote}</Text></View>}
              <View style={styles.mainMetrics}><MetricBox label="PESO OBJETIVO" value={activeExercise.weightKg === undefined ? 'Corporal' : kgText(activeExercise.weightKg)} /><MetricBox label="REPETICIONES" value={activeExercise.reps} /><MetricBox label="DESCANSO" value={formatRest(activeExercise.restSeconds)} /></View>
              <View style={styles.setsCard}><View style={styles.sectionTitleRow}><Text style={styles.cardTitle}>Series</Text><Text style={styles.mutedTiny}>{exerciseLogs.length}/{activeExercise.sets} COMPLETADAS</Text></View>{Array.from({length:activeExercise.sets},(_,i)=>{const log=exerciseLogs[i];return <View key={i} style={[styles.setRow,log&&styles.setRowDone]}><View style={[styles.setNumber,log&&styles.setNumberDone]}><Text style={[styles.setNumberText,log&&styles.setNumberTextDone]}>{i+1}</Text></View><View style={{flex:1}}><Text style={styles.setName}>Serie {i+1}</Text><Text style={styles.setDetail}>{log ? `${kgText(log.weightKg)} · ${log.reps} reps${log.rir !== undefined ? ` · RIR ${log.rir}` : ''}` : `${activeExercise.reps} reps objetivo`}</Text></View><Text style={[styles.setState,log&&{color:C.green}]}>{log?'✓':'PENDIENTE'}</Text></View>;})}</View>
              {data.activeSession.restEndsAt && restRemaining>0 && <View style={styles.restCard}><Text style={styles.eyebrow}>DESCANSO</Text><Text style={styles.timer}>{formatRest(restRemaining)}</Text><Text style={styles.mutedSmall}>Recupera y prepárate para la siguiente serie.</Text><View style={styles.restControls}><Pressable style={styles.smallOutlineButton} onPress={() => addRest(15)}><Text style={styles.smallOutlineText}>+15 s</Text></Pressable><Pressable style={styles.smallOutlineButton} onPress={() => addRest(30)}><Text style={styles.smallOutlineText}>+30 s</Text></Pressable><Pressable style={styles.smallOutlineButton} onPress={skipRest}><Text style={styles.smallOutlineText}>Saltar</Text></Pressable></View></View>}
              {!data.activeSession.restEndsAt && <Pressable style={styles.primaryButton} onPress={openSetModal}><Text style={styles.primaryButtonText}>{exerciseLogs.length < activeExercise.sets ? 'ACABAR SERIE / REGISTRAR' : 'SERIES COMPLETADAS'} ↗</Text></Pressable>}
              {exerciseLogs.length >= activeExercise.sets && <View style={styles.successBanner}><Text style={styles.successTitle}>Ejercicio completado</Text><Text style={styles.successText}>Has registrado las {activeExercise.sets} series previstas.</Text></View>}
              <Text style={styles.exerciseNotes}>{activeExercise.notes ?? 'Mantén una técnica controlada y registra el esfuerzo real.'}</Text>
            </> : activePlan?.kind === 'strength' ? <View style={styles.successBanner}><Text style={styles.successTitle}>Rutina completada</Text><Text style={styles.successText}>Has llegado al final de los ejercicios programados. Finaliza la sesión para guardar el resumen.</Text></View> : <View style={styles.activityCard}><Text style={styles.eyebrow}>ACTIVIDAD EN CURSO</Text><Text style={styles.cardTitleXL}>{activePlan?.title}</Text><Text style={styles.mutedSmall}>Duración prevista: {activePlan?.duration ?? 'Flexible'}</Text><Text style={styles.muted}>{activePlan?.note}</Text><Text style={styles.activityTimer}>{formatDuration(Math.max(0,Math.round((clockNow-new Date(data.activeSession.startedAt).getTime())/1000)))}</Text><TextInput value={sessionNote} onChangeText={setSessionNote} placeholder="Notas (distancia, sensaciones, desnivel…)" placeholderTextColor={C.muted} style={[styles.input,{minHeight:86,textAlignVertical:'top'}]} multiline /></View>}
            <View style={styles.sessionFooter}><Pressable onPress={() => finishSession(true)} style={styles.cancelButton}><Text style={styles.cancelText}>Abandonar</Text></Pressable><Pressable onPress={() => finishSession(false)} style={styles.finishButton}><Text style={styles.finishText}>FINALIZAR SESIÓN</Text></Pressable></View>
          </>}
        </ScrollView>}

        {tab === 'progreso' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPad}>
          <Text style={styles.eyebrow}>DATOS REALES · HISTORIAL</Text><Text style={styles.h1}>Tu progreso.</Text><Text style={styles.muted}>Todo lo que registres aquí alimentará tus estadísticas.</Text>
          <View style={styles.coachCard}>
            <Text style={styles.eyebrow}>MY COACH · ENTRENADOR INTELIGENTE</Text>
            <Text style={styles.cardTitleLarge}>Tu plan se adapta a tus datos.</Text>
            <Text style={styles.mutedSmall}>El motor local reajusta cargas y series a partir de tus resultados, la puntuación de cada sesión y la recuperación reciente. La IA generativa puede proponer cambios para revisar o aplicarlos automáticamente si activas expresamente ese modo.</Text>
            <View style={styles.dataNote}><Text style={styles.dataNoteTitle}>Estado del motor local</Text><Text style={styles.mutedSmall}>{(() => { const r = latestReadiness(data.recoveryEntries ?? [], dateKey(new Date())).status; const f = trainingFeedbackSignal(data.history ?? [], dateKey(new Date())).status; return r === 'baja' || f === 'baja' ? 'Señales de fatiga: la fuerza se adapta reduciendo carga y/o una serie. Revisa cómo te encuentras antes de empezar.' : r === 'moderada' || f === 'moderada' ? 'Precaución: mantiene la carga y frena las subidas automáticas.' : 'Sin señales recientes fuertes de fatiga. La progresión depende de completar repeticiones y registrar buenas sensaciones.'; })()}</Text></View>
            <Text style={styles.fieldLabel}>URL DE LA FUNCIÓN IA EN NETLIFY</Text>
            <TextInput value={coachEndpoint} onChangeText={setCoachEndpoint} autoCapitalize="none" keyboardType="url" style={styles.input} placeholder="https://tu-sitio.netlify.app/.netlify/functions/coach-ai" placeholderTextColor={C.muted}/>
            <Text style={styles.fieldLabel}>CÓDIGO DE ACCESO (COACH_ACCESS_TOKEN)</Text>
            <TextInput value={coachAccessCode} onChangeText={value => { setCoachAccessCode(value); setData(current => ({ ...current, coachAccessCode: value })); }} autoCapitalize="none" secureTextEntry style={styles.input} placeholder="Código guardado en Netlify · no es la API key" placeholderTextColor={C.muted}/>
            <Text style={styles.mutedTiny}>El resumen de las últimas sesiones (incluidos los comentarios que hayas añadido), las métricas de recuperación y los entrenamientos próximos se envían a Claude a través de Netlify cuando solicitas un análisis. No se envían la captura almacenada ni el nombre del perfil. La API puede generar costes.</Text>
            <Pressable accessibilityRole="button" onPress={() => { if (data.autoCoachEnabled) { setData(current => ({ ...current, autoCoachEnabled: false })); showInfo('Autoajuste IA desactivado', 'La IA ya no se ejecutará automáticamente al cerrar sesiones o guardar recuperación. La progresión local sigue activa.'); } else showConfirm({ title: 'Activar autoajuste con IA', message: 'Después de finalizar una sesión o guardar métricas de recuperación, se enviará un resumen de tus datos de entrenamiento y comentarios asociados a Claude mediante Netlify. La IA podrá aplicar únicamente cambios validados a sesiones futuras. Esto utiliza una API externa y puede generar costes. ¿Quieres activarlo?', confirmLabel: 'ACTIVAR AUTOAJUSTE', onConfirm: () => setData(current => ({ ...current, autoCoachEnabled: true })) }); }} style={[styles.secondaryButton, data.autoCoachEnabled && { borderColor: C.accent }]}><Text style={styles.secondaryButtonText}>{data.autoCoachEnabled ? 'AUTOAJUSTE IA ACTIVADO · TOCAR PARA DESACTIVAR' : 'ACTIVAR AUTOAJUSTE IA AUTOMÁTICO'}</Text></Pressable>
            <Text style={styles.mutedTiny}>{data.autoCoachEnabled ? 'Modo automático activado: analizará al finalizar una sesión completada y al guardar un registro de recuperación. Solo se aplican propuestas futuras dentro de límites conservadores. El código de acceso se guarda localmente en este dispositivo; la clave API de Anthropic permanece exclusivamente en Netlify.' : 'Si no activas el modo automático, puedes lanzar el análisis manualmente y revisar los cambios antes de aplicarlos. El motor local reajusta el plan sin enviar datos a servicios externos.'}</Text>
            <Pressable accessibilityRole="button" disabled={coachBusy} style={[styles.primaryButton, coachBusy && { opacity: 0.6 }]} onPress={() => void runAiCoach()}><Text style={styles.primaryButtonText}>{coachBusy ? 'ANALIZANDO TUS DATOS…' : 'ANALIZAR PROGRESO CON IA ↗'}</Text></Pressable>
            {data.coachReport ? <View style={styles.aiReportCard}><Text style={styles.sectionHeader}>ÚLTIMO ANÁLISIS · {data.coachLastUpdatedAt ? new Date(data.coachLastUpdatedAt).toLocaleString('es-ES') : 'GUARDADO'}</Text><Text style={styles.aiReportText}>{data.coachReport}</Text></View> : null}
            {(data.pendingCoachAdjustments ?? []).length > 0 ? <View style={styles.aiReportCard}><Text style={styles.sectionHeader}>PROPUESTAS PARA FUTUROS ENTRENAMIENTOS</Text><Text style={styles.mutedSmall}>Revisa los cambios antes de aplicarlos. Solo afectarán a las fechas futuras indicadas.</Text>{(data.pendingCoachAdjustments ?? []).map((item, index) => { const baseExercise = [...weeklyPlan, ...(data.customProgram ?? [])].flatMap(p => p.exercises).find(e => e.id === item.exerciseId); const activityName = item.exerciseId === '__session__' ? getUserPlan(parseDateKey(item.dateKey).getDay(), item.dateKey, data).title : item.exerciseId; return <View key={`${item.dateKey}-${item.exerciseId}-${index}`} style={styles.aiSuggestionRow}><Text style={styles.referenceName}>{item.dateKey} · {baseExercise?.name ?? activityName}</Text><Text style={styles.mutedSmall}>{[item.weightKg !== undefined ? `Peso ${String(item.weightKg).replace('.',',')} kg` : '', item.sets !== undefined ? `${item.sets} series` : '', item.reps ? `${item.reps} reps` : '', item.restSeconds !== undefined ? `Descanso ${formatRest(item.restSeconds)}` : '', item.sessionDurationMinutes !== undefined ? `${item.sessionDurationMinutes} min de duración` : '', item.sessionIntensity ? `Intensidad ${item.sessionIntensity === 'easy' ? 'suave' : 'moderada'}` : ''].filter(Boolean).join(' · ')}</Text><Text style={styles.mutedTiny}>{item.reason}</Text></View>; })}<View style={styles.modalButtons}><Pressable style={styles.cancelButton} onPress={discardCoachAdjustments}><Text style={styles.cancelText}>DESCARTAR</Text></Pressable><Pressable style={styles.finishButton} onPress={applyCoachAdjustments}><Text style={styles.finishText}>APLICAR AJUSTES</Text></Pressable></View></View> : null}
            {Object.keys(data.planAdjustments ?? {}).length > 0 ? <Text style={styles.mutedTiny}>Ajustes de IA aplicados a fechas futuras: {Object.keys(data.planAdjustments ?? {}).length}. No modifican el historial.</Text> : null}
          </View>
          <View style={styles.statRow}><StatCard label="SESIONES" value={String(data.history.filter(s => s.status !== 'abandoned').length)} footer="Sesiones finalizadas"/><StatCard label="SERIES" value={String(data.history.reduce((sum,s)=>sum+s.sets.length,0))} footer="Series registradas"/></View>
          <View style={styles.statRow}><StatCard label="VOLUMEN TOTAL" value={`${Math.round(data.history.reduce((sum,s)=>sum+sessionVolume(s.sets),0)).toLocaleString('es-ES')} kg`} footer="Peso × repeticiones"/><StatCard label="PESO ACTUAL" value={`${data.profile.currentWeightKg.replace('.',',')} kg`} footer="Editable en Perfil"/></View>
          <SectionTitle title="MÉTRICAS DE ACTIVIDAD" />
          <View style={styles.statRow}><StatCard label="DISTANCIA REGISTRADA" value={`${activitySummary.totalDistanceKm.toLocaleString('es-ES',{maximumFractionDigits:1})} km`} footer={`${activitySummary.sessionCount} sesiones con métricas`}/><StatCard label="DESNIVEL POSITIVO" value={`${Math.round(activitySummary.totalElevationM).toLocaleString('es-ES')} m`} footer="Suma de registros guardados"/></View>
          <View style={styles.statRow}><StatCard label="FC MEDIA POR SESIÓN" value={activitySummary.averageHeartRate !== undefined ? `${Math.round(activitySummary.averageHeartRate)} bpm` : '—'} footer="Media de sesiones con dato"/><StatCard label="ÚLTIMA VELOCIDAD" value={activitySummary.latestSpeed !== undefined ? `${activitySummary.latestSpeed.toLocaleString('es-ES',{maximumFractionDigits:1})} km/h` : activitySummary.latestPace !== undefined ? `${formatPace(activitySummary.latestPace)} min/km` : '—'} footer={activitySummary.latestSpeed !== undefined ? 'Último dato guardado' : 'Último ritmo de carrera'}/></View>
          <SectionTitle title="EVOLUCIÓN CORPORAL" />
          <View style={styles.bodyTrendCard}>{data.bodyMeasurements.length === 0 ? <Text style={styles.mutedSmall}>Registra una medición en Perfil para empezar a seguir la evolución corporal.</Text> : data.bodyMeasurements.slice(-6).reverse().map(m => <View key={m.id} style={styles.bodyTrendRow}><View style={{flex:1}}><Text style={styles.referenceName}>{m.dateKey} {m.source==='bascula'?'· Medición inicial':'· Registrado por ti'}</Text><View style={styles.bodyBarTrack}><View style={[styles.bodyBarFill,{width:`${Math.min(100,Math.max(18, (m.weightKg/Math.max(...data.bodyMeasurements.map(x=>x.weightKg))*100)))}%`}]} /></View><Text style={styles.mutedTiny}>{m.bodyFatPercent !== undefined ? `Grasa ${String(m.bodyFatPercent).replace('.',',')} %` : m.waistCm || m.armCm || m.chestCm ? `Cintura ${m.waistCm ?? '—'} cm · Brazo ${m.armCm ?? '—'} cm · Pecho ${m.chestCm ?? '—'} cm` : 'Sin otros valores registrados'}</Text></View><Text style={styles.referenceLoad}>{String(m.weightKg).replace('.',',')} kg</Text></View>)}</View>
          <SectionTitle title="HISTORIAL DE SESIONES" />
          {data.history.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyCardTitle}>Aún no hay sesiones reales registradas.</Text><Text style={styles.mutedSmall}>Cuando completes tu primer entrenamiento, aparecerán aquí tus ejercicios, series, volumen y duración. No rellenamos el historial con valores ficticios.</Text></View> : data.history.map(session => <View key={session.id} style={styles.historyCard}><View style={styles.historyHead}><View style={{flex:1}}><Text style={styles.cardTitle}>{session.title}</Text><Text style={styles.mutedTiny}>{session.dateKey} · {formatDuration(session.durationSeconds)}{session.status === 'abandoned' ? ' · INCOMPLETA' : ''}</Text></View><Text style={styles.historyVolume}>{session.sets.length ? `${Math.round(sessionVolume(session.sets)).toLocaleString('es-ES')} kg` : 'ACTIVIDAD'}</Text></View><Text style={styles.historySub}>{session.sets.length} series · {session.sets.reduce((sum,s)=>sum+s.reps,0)} repeticiones</Text>{session.sets.slice(0,4).map(log=><Text key={log.id} style={styles.mutedTiny}>• {log.exerciseName ?? log.exerciseId}: {kgText(log.weightKg)} × {log.reps}</Text>)}{session.note ? <Text style={styles.mutedSmall}>{session.note}</Text> : null}{session.feedback ? <View style={styles.sessionFeedbackCard}><View style={styles.sessionFeedbackRow}><Text style={{fontSize:23}}>{MOOD_OPTIONS.find(m => m.value === session.feedback?.mood)?.emoji ?? '😐'}</Text><View style={{flex:1}}><Text style={styles.referenceName}>{MOOD_OPTIONS.find(m => m.value === session.feedback?.mood)?.label ?? 'Sensaciones registradas'}</Text><Text style={styles.mutedTiny}>Esfuerzo percibido (RPE): {session.feedback.rpe}/10</Text></View></View>{session.feedback.note ? <Text style={styles.mutedSmall}>{session.feedback.note}</Text> : null}{Object.entries(session.feedback.metrics).filter(([, value]) => value !== undefined).map(([key,value]) => { const labels: Record<string,string> = { avgHrBpm:'FC media', maxHrBpm:'FC máx.', distanceKm:'Distancia', elevationGainM:'Desnivel +', avgSpeedKmh:'Velocidad media', maxSpeedKmh:'Velocidad máx.', paceMinPerKm:'Ritmo medio', caloriesKcal:'Calorías', avgCadenceRpm:'Cadencia media', avgPowerW:'Potencia media' }; const cycling = /ciclismo|btt|bike/i.test(session.title); const units: Record<string,string> = { avgHrBpm:' bpm', maxHrBpm:' bpm', distanceKm:' km', elevationGainM:' m', avgSpeedKmh:' km/h', maxSpeedKmh:' km/h', paceMinPerKm:' min/km', caloriesKcal:' kcal', avgCadenceRpm: cycling ? ' rpm' : ' pasos/min', avgPowerW:' W' }; const shown = key === 'paceMinPerKm' ? formatPace(Number(value)) : String(value).replace('.',','); return <Text key={key} style={styles.mutedTiny}>{labels[key] ?? key}: {shown}{units[key] ?? ''}</Text>; })}</View> : null}<Pressable accessibilityRole="button" onPress={() => deleteCompletedSession(session)} style={styles.deleteHistoryButton}><Text style={styles.deleteHistoryText}>ELIMINAR SESIÓN DEL HISTORIAL</Text></Pressable></View>)}
          <Notice text="Todavía no hay suficientes mediciones para calcular ganancias de fuerza o masa muscular. La app empezará a crear tendencias al acumular datos fiables." />
        </ScrollView>}

        {tab === 'coach' && <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}>
          <View style={{flex:1,paddingHorizontal:16,paddingTop:18,paddingBottom:10}}>
            <Text style={styles.eyebrow}>MY COACH · CONVERSACIÓN PERSONAL</Text><Text style={styles.h1}>¿Cómo te encuentras?</Text><Text style={styles.mutedSmall}>Cuéntame tus sensaciones, sueño, fatiga o dudas. Revisaré tu historial y tu plan actual antes de recomendar cambios.</Text>
            <View style={{flex:1,marginTop:12,minHeight:220}}>
              <ScrollView ref={chatScrollRef} style={{flex:1}} contentContainerStyle={{gap:10,paddingBottom:16}} keyboardShouldPersistTaps="handled" onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}>
                {(data.chatMessages ?? []).length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyCardTitle}>Tu entrenador está listo.</Text><Text style={styles.mutedSmall}>Puedes hablar con él con tus propias palabras. No hace falta completar un formulario para cada consulta.</Text>{['Hoy estoy cansado, revisa mi entrenamiento','Analiza mi sueño y recuperación reciente','¿Cómo va mi progreso de fuerza?','Quiero modificar la próxima sesión'].map(question=><Pressable key={question} onPress={()=>void sendChatMessage(question)} style={[styles.navMenuOption,{backgroundColor:C.surface2,borderColor:C.border,marginTop:9,minHeight:49}]}><Text style={{color:C.text,fontSize:11,fontWeight:'700',flex:1}}>{question}</Text><Text style={{color:C.accent,fontWeight:'900'}}>↗</Text></Pressable>)}</View> : null}
                {(data.chatMessages ?? []).map(message=><View key={message.id} style={{maxWidth:'94%',alignSelf:message.role==='user'?'flex-end':'flex-start',backgroundColor:message.role==='user'?'rgba(200,255,66,.12)':C.surface,borderWidth:1,borderColor:message.role==='user'?'rgba(200,255,66,.3)':C.border,borderRadius:16,padding:12}}><Text style={{fontSize:8,fontWeight:'900',letterSpacing:1,color:message.role==='user'?C.accent:C.muted,marginBottom:6}}>{message.role==='user'?'TÚ':'MY COACH'}</Text><Text selectable style={{fontSize:12,lineHeight:19,color:C.text}}>{message.content}</Text><Text style={{fontSize:8,color:C.muted,marginTop:7}}>{new Date(message.createdAt).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</Text></View>)}
                {chatSending ? <View style={[styles.aiReportCard,{alignSelf:'flex-start'}]}><Text style={styles.mutedSmall}>My Coach está revisando tu contexto…</Text></View> : null}
              </ScrollView>
            </View>
            {(data.pendingCoachAdjustments ?? []).length > 0 ? <Pressable style={[styles.secondaryButton,{marginTop:8,borderColor:C.accent}]} onPress={()=>setTab('progreso')}><Text style={styles.secondaryButtonText}>REVISAR {data.pendingCoachAdjustments?.length} CAMBIOS PROPUESTOS EN PROGRESO ↗</Text></Pressable> : null}
            <View style={{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:10}}><TextInput value={chatDraft} onChangeText={setChatDraft} multiline maxLength={2500} placeholder="Cuéntame cómo te encuentras…" placeholderTextColor={C.muted} style={[styles.input,{flex:1,minHeight:48,maxHeight:118,paddingTop:13,textAlignVertical:'top'}]} onSubmitEditing={()=>{if(Platform.OS==='web')void sendChatMessage();}}/><Pressable disabled={chatSending || !chatDraft.trim()} onPress={()=>void sendChatMessage()} style={[styles.primaryButton,{width:92,height:48,marginTop:0,opacity:chatSending||!chatDraft.trim()?0.5:1}]}><Text style={styles.primaryButtonText}>{chatSending?'…':'ENVIAR ↗'}</Text></Pressable></View>
            <Text style={[styles.mutedTiny,{marginTop:7}]}>La IA ofrece recomendaciones deportivas, no diagnósticos médicos. Los cambios de planificación se validan antes de aplicarse.</Text>
          </View>
        </KeyboardAvoidingView>}

        {tab === 'recuperacion' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPad}>
          <Text style={styles.eyebrow}>GARMIN CONNECT · REGISTRO MANUAL</Text><Text style={styles.h1}>Tu recuperación.</Text><Text style={styles.muted}>Sin pedir acceso a Garmin ni compartir credenciales. Adjunta una captura del resumen de sueño/recuperación y registra los valores visibles.</Text>
          <View style={styles.dataNote}><Text style={styles.dataNoteTitle}>Análisis de sueño y fatiga</Text><Text style={styles.mutedSmall}>{recoveryInsights.sleepAvg !== undefined ? `Sueño medio de los últimos registros: ${recoveryInsights.sleepAvg.toLocaleString('es-ES',{maximumFractionDigits:1})} h. ` : 'Faltan horas de sueño registradas para calcular una media. '}{recoveryInsights.sleepScoreAvg !== undefined ? `Puntuación media de sueño: ${Math.round(recoveryInsights.sleepScoreAvg)}/100. ` : ''}{recoveryInsights.latest ? `Último registro (${recoveryInsights.latest.dateKey}): ${recoveryInsights.latest.readiness==='baja'?'recuperación baja':recoveryInsights.latest.readiness==='moderada'?'recuperación moderada':recoveryInsights.latest.readiness==='buena'?'sin alertas claras':'sin datos suficientes'}. ` : ''}{recoveryInsights.rpeAvg !== undefined ? `RPE medio de las últimas sesiones valoradas: ${recoveryInsights.rpeAvg.toLocaleString('es-ES',{maximumFractionDigits:1})}/10. ` : ''}{recoveryInsights.fatigue}</Text><Pressable style={[styles.secondaryButton,{marginTop:10}]} onPress={()=>{setChatDraft('Analiza en conjunto mi sueño, recuperación, fatiga y entrenamientos recientes. Propón cambios solo si los datos lo justifican.');setTab('coach');}}><Text style={styles.secondaryButtonText}>CONSULTAR AL ENTRENADOR IA ↗</Text></Pressable></View>
          <View style={styles.recoveryForm}>
            <Text style={styles.sectionHeader}>{recoveryEditingId ? 'EDITAR REGISTRO DE RECUPERACIÓN' : 'CAPTURA DE GARMIN CONNECT'}</Text>
            <Text style={styles.mutedTiny}>La imagen se guarda de forma privada. La app no lee automáticamente los números de la captura: rellena las métricas visibles. Puedes editar cualquiera de tus registros históricos.</Text>
            <Text style={styles.fieldLabel}>FECHA DEL REGISTRO (AAAA-MM-DD)</Text><TextInput value={recoveryDraft.dateKey} onChangeText={v=>setRecoveryDraft(d=>({...d,dateKey:v}))} autoCapitalize="none" style={styles.input} placeholder="2026-10-19" placeholderTextColor={C.muted}/>
            <Pressable style={styles.secondaryButton} onPress={pickRecoveryScreenshot}><Text style={styles.secondaryButtonText}>{recoveryImage ? 'CAMBIAR CAPTURA' : 'AÑADIR CAPTURA'}</Text></Pressable>
            {recoveryImage ? <View style={styles.recoveryImageWrap}><Image source={{uri: recoveryImage}} style={styles.recoveryImage} resizeMode="contain"/><Pressable onPress={()=>{setRecoveryImage(undefined);setRemoveRecoveryImage(true);}} style={styles.smallOutlineButton}><Text style={styles.smallOutlineText}>Quitar imagen</Text></Pressable></View> : null}
            <Text style={styles.fieldLabel}>SUEÑO (HORAS)</Text><TextInput value={recoveryDraft.sleepHours} onChangeText={v=>setRecoveryDraft(d=>({...d,sleepHours:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="Ej. 7,5" placeholderTextColor={C.muted}/>
            <View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>PUNTUACIÓN SUEÑO (0–100)</Text><TextInput value={recoveryDraft.sleepScore} onChangeText={v=>setRecoveryDraft(d=>({...d,sleepScore:v}))} keyboardType="number-pad" style={styles.input} placeholder="Ej. 78" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>BODY BATTERY (0–100)</Text><TextInput value={recoveryDraft.bodyBattery} onChangeText={v=>setRecoveryDraft(d=>({...d,bodyBattery:v}))} keyboardType="number-pad" style={styles.input} placeholder="Ej. 65" placeholderTextColor={C.muted}/></View></View>
            <View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>VFC / HRV (MS)</Text><TextInput value={recoveryDraft.hrvMs} onChangeText={v=>setRecoveryDraft(d=>({...d,hrvMs:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="Ej. 58" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>PULSO EN REPOSO (BPM)</Text><TextInput value={recoveryDraft.restingHrBpm} onChangeText={v=>setRecoveryDraft(d=>({...d,restingHrBpm:v}))} keyboardType="number-pad" style={styles.input} placeholder="Ej. 52" placeholderTextColor={C.muted}/></View></View>
            <View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>ESTRÉS DIARIO (0–100)</Text><TextInput value={recoveryDraft.stressScore} onChangeText={v=>setRecoveryDraft(d=>({...d,stressScore:v}))} keyboardType="number-pad" style={styles.input} placeholder="Ej. 35" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>ENERGÍA PERCIBIDA (1–10)</Text><TextInput value={recoveryDraft.energyScore} onChangeText={v=>setRecoveryDraft(d=>({...d,energyScore:v}))} keyboardType="number-pad" style={styles.input} placeholder="Ej. 7" placeholderTextColor={C.muted}/></View></View>
            <Text style={styles.fieldLabel}>NOTAS (OPCIONAL)</Text><TextInput value={recoveryDraft.notes} onChangeText={v=>setRecoveryDraft(d=>({...d,notes:v}))} style={[styles.input,{minHeight:76,textAlignVertical:'top'}]} multiline placeholder="Sensaciones, molestias, sueño interrumpido…" placeholderTextColor={C.muted}/>
            <Pressable style={styles.primaryButton} onPress={saveRecovery}><Text style={styles.primaryButtonText}>{recoveryEditingId ? 'GUARDAR CAMBIOS Y REEVALUAR' : 'GUARDAR Y AJUSTAR PLAN'}</Text></Pressable>{recoveryEditingId ? <Pressable style={styles.secondaryButton} onPress={()=>{setRecoveryEditingId(null);setRecoveryDraft({dateKey:dateKey(new Date()),sleepHours:'',sleepScore:'',hrvMs:'',restingHrBpm:'',bodyBattery:'',stressScore:'',energyScore:'',notes:''});setRecoveryImage(undefined);setRemoveRecoveryImage(false);}}><Text style={styles.secondaryButtonText}>CANCELAR EDICIÓN</Text></Pressable> : null}
          </View>
          <View style={styles.dataNote}><Text style={styles.dataNoteTitle}>Cómo influye en tu planificación</Text><Text style={styles.mutedSmall}>Las métricas se comparan con rangos prudentes y, cuando hay suficiente historial, con tu propia tendencia. Una lectura marcada como recuperación baja puede reducir alrededor de un 5 % la carga propuesta y una serie en ejercicios de 3+ series para sesiones de fuerza cercanas. Una lectura moderada recomienda mantener cargas y dejar más repeticiones en reserva. No es un diagnóstico ni sustituye tus sensaciones.</Text></View>
          <SectionTitle title="REGISTROS DE RECUPERACIÓN" />
          {(data.recoveryEntries ?? []).length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyCardTitle}>Todavía no hay registros.</Text><Text style={styles.mutedSmall}>Cuando añadas una captura o métricas, aquí aparecerán las tendencias y recomendaciones.</Text></View> : [...data.recoveryEntries].reverse().map(entry => <View key={entry.id} style={styles.recoveryHistoryCard}><View style={styles.historyHead}><View style={{flex:1}}><Text style={styles.cardTitle}>{entry.dateKey}</Text><Text style={styles.mutedTiny}>{entry.readiness === 'baja' ? 'RECUPERACIÓN BAJA' : entry.readiness === 'moderada' ? 'RECUPERACIÓN MODERADA' : entry.readiness === 'buena' ? 'RECUPERACIÓN SIN ALERTAS CLARAS' : 'SIN DATOS SUFICIENTES'}</Text></View><Text style={[styles.recoveryStatusText,{color:entry.readiness==='baja'?C.red:entry.readiness==='moderada'?C.warning:entry.readiness==='buena'?C.green:C.muted}]}>{entry.readiness==='baja'?'BAJA':entry.readiness==='moderada'?'MEDIA':entry.readiness==='buena'?'BUENA':'—'}</Text></View>{entry.imageDataUri ? <Image source={{uri:entry.imageDataUri}} style={styles.recoveryHistoryImage} resizeMode="contain"/> : null}<View style={styles.nutriStats}>{entry.sleepHours !== undefined ? <Text style={styles.nutriStat}>Sueño {String(entry.sleepHours).replace('.',',')} h</Text>:null}{entry.sleepScore !== undefined ? <Text style={styles.nutriStat}>Sueño {entry.sleepScore}/100</Text>:null}{entry.hrvMs !== undefined ? <Text style={styles.nutriStat}>VFC {entry.hrvMs} ms</Text>:null}{entry.restingHrBpm !== undefined ? <Text style={styles.nutriStat}>Reposo {entry.restingHrBpm} bpm</Text>:null}{entry.bodyBattery !== undefined ? <Text style={styles.nutriStat}>Body Battery {entry.bodyBattery}</Text>:null}{entry.stressScore !== undefined ? <Text style={styles.nutriStat}>Estrés {entry.stressScore}</Text>:null}</View><Text style={styles.mutedSmall}>{entry.recommendation}</Text>{entry.notes ? <Text style={styles.mutedTiny}>{entry.notes}</Text>:null}<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Pressable style={[styles.smallOutlineButton,{marginTop:12}]} onPress={()=>editRecoveryEntry(entry)}><Text style={styles.smallOutlineText}>EDITAR REGISTRO</Text></Pressable><Pressable style={styles.deleteHistoryButton} onPress={()=>deleteRecoveryEntry(entry)}><Text style={styles.deleteHistoryText}>ELIMINAR REGISTRO</Text></Pressable></View></View>)}
        </ScrollView>}

        {tab === 'perfil' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenPad}>
          <Text style={styles.eyebrow}>TU INFORMACIÓN</Text><Text style={styles.h1}>Perfil personal.</Text><Text style={styles.muted}>Edita tus datos y preferencias.</Text>
          <View style={styles.profileForm}><Text style={styles.fieldLabel}>NOMBRE</Text><TextInput value={profileDraft.name} onChangeText={v=>setProfileDraft(p=>({...p,name:v}))} style={styles.input} placeholder="Nombre" placeholderTextColor={C.muted}/><View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>EDAD</Text><TextInput value={profileDraft.age} onChangeText={v=>setProfileDraft(p=>({...p,age:v}))} keyboardType="number-pad" style={styles.input} placeholder="Años" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>ALTURA (CM)</Text><TextInput value={profileDraft.heightCm} onChangeText={v=>setProfileDraft(p=>({...p,heightCm:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="cm" placeholderTextColor={C.muted}/></View></View><View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>PESO ACTUAL (KG)</Text><TextInput value={profileDraft.currentWeightKg} onChangeText={v=>setProfileDraft(p=>({...p,currentWeightKg:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="kg" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>PESO OBJETIVO (KG)</Text><TextInput value={profileDraft.goalWeightKg} onChangeText={v=>setProfileDraft(p=>({...p,goalWeightKg:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="kg" placeholderTextColor={C.muted}/></View></View><Text style={styles.fieldLabel}>OBJETIVO DE GRASA CORPORAL (%)</Text><TextInput value={profileDraft.goalFatPercent} onChangeText={v=>setProfileDraft(p=>({...p,goalFatPercent:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="%" placeholderTextColor={C.muted}/><Text style={styles.fieldLabel}>NOTAS</Text><TextInput value={profileDraft.notes} onChangeText={v=>setProfileDraft(p=>({...p,notes:v}))} style={[styles.input,{minHeight:80,textAlignVertical:'top'}]} multiline placeholder="Notas del perfil" placeholderTextColor={C.muted}/><Pressable style={styles.primaryButton} onPress={saveProfile}><Text style={styles.primaryButtonText}>GUARDAR PERFIL</Text></Pressable>{supabaseConfigured && authUser ? <Pressable style={[styles.secondaryButton,{marginTop:10}]} onPress={()=>showConfirm({title:'Volver a configurar tu plan',message:'Se abrirá el cuestionario de personalización. Tu historial y sesiones ya realizadas se conservarán; al finalizar se generará una nueva programación semanal.',confirmLabel:'ABRIR CUESTIONARIO',onConfirm:()=>{setOnboardingAnswers({...EMPTY_ONBOARDING,...(data.onboarding?.answers ?? {})});setOnboardingStep(0);setData(current=>({...current,onboarding:{...(current.onboarding ?? {completed:false}),completed:false}}));setTab('inicio');}})}><Text style={styles.secondaryButtonText}>REVISAR CUESTIONARIO DE PLANIFICACIÓN</Text></Pressable> : null}</View>
          {(!data.onboarding?.answers && data.profile.name === 'Marc') && <View style={styles.baselineCard}><Text style={styles.sectionHeader}>MEDICIÓN CORPORAL DE REFERENCIA</Text><Text style={styles.mutedTiny}>Báscula de bioimpedancia · 09/10/2026 · una sola medición</Text><View style={styles.baselineGrid}><MetricBox label="GRASA CORPORAL" value="13,0 %"/><MetricBox label="MASA LIBRE DE GRASA" value="57,5 kg"/></View><View style={styles.baselineGrid}><MetricBox label="PESO MUSCULAR (BÁSCULA)" value="34,6 kg"/><MetricBox label="METABOLISMO BASAL*" value="1.528 kcal"/></View><Text style={styles.mutedTiny}>*Dato estimado por la báscula. No es una valoración clínica ni hay todavía una tendencia temporal.</Text></View>}
          {(!data.onboarding?.answers && data.profile.name === 'Marc') && <View style={styles.baselineCard}><Text style={styles.sectionHeader}>CARGAS DE REFERENCIA DECLARADAS</Text><Text style={styles.mutedTiny}>Datos indicados en la ficha; falta verificar detalles de algunas cargas.</Text>{[['Press de banca','45 kg','Confirmar si es peso total con barra'],['Press inclinado con mancuernas','15 kg por lado','Referencia declarada'],['Curl de bíceps','15 kg','Confirmar si es por mano o peso total'],['Elevaciones de hombros','12,5 kg','Confirmar ejercicio y material']].map(([name,load,note])=><View key={name} style={styles.referenceRow}><View style={{flex:1}}><Text style={styles.referenceName}>{name}</Text><Text style={styles.mutedTiny}>{note}</Text></View><Text style={styles.referenceLoad}>{load}</Text></View>)}</View>}
          <View style={styles.baselineCard}><Text style={styles.sectionHeader}>REGISTRAR MEDICIÓN ACTUAL</Text><Text style={styles.mutedTiny}>Introduce el peso y, si los conoces, tus perímetros. Se guardarán con la fecha de hoy.</Text><Text style={styles.fieldLabel}>PESO CORPORAL (KG) *</Text><TextInput value={measurementDraft.weightKg} onChangeText={v=>setMeasurementDraft(d=>({...d,weightKg:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="66,1" placeholderTextColor={C.muted}/><View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>GRASA (%) OPCIONAL</Text><TextInput value={measurementDraft.bodyFatPercent} onChangeText={v=>setMeasurementDraft(d=>({...d,bodyFatPercent:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="13" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>CINTURA (CM)</Text><TextInput value={measurementDraft.waistCm} onChangeText={v=>setMeasurementDraft(d=>({...d,waistCm:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="—" placeholderTextColor={C.muted}/></View></View><View style={styles.formRow}><View style={{flex:1}}><Text style={styles.fieldLabel}>BRAZO (CM)</Text><TextInput value={measurementDraft.armCm} onChangeText={v=>setMeasurementDraft(d=>({...d,armCm:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="—" placeholderTextColor={C.muted}/></View><View style={{flex:1}}><Text style={styles.fieldLabel}>PECHO (CM)</Text><TextInput value={measurementDraft.chestCm} onChangeText={v=>setMeasurementDraft(d=>({...d,chestCm:v}))} keyboardType="decimal-pad" style={styles.input} placeholder="—" placeholderTextColor={C.muted}/></View></View><Pressable style={styles.primaryButton} onPress={saveMeasurement}><Text style={styles.primaryButtonText}>GUARDAR MEDICIÓN</Text></Pressable></View>
          <View style={styles.settingsCard}><View style={styles.settingRow}><View style={{flex:1}}><Text style={styles.cardTitle}>Recordatorios</Text><Text style={styles.mutedSmall}>Aviso 30 minutos antes de cada sesión.</Text></View><Text style={[styles.reminderStatus,{color:data.reminderEnabled?C.green:C.warning}]}>{data.reminderEnabled?'ACTIVOS':'INACTIVOS'}</Text></View>{data.reminderEnabled ? <Pressable style={styles.secondaryButton} onPress={disableReminders}><Text style={styles.secondaryButtonText}>Desactivar recordatorios</Text></Pressable> : <Pressable style={styles.primaryButton} onPress={enableReminders}><Text style={styles.primaryButtonText}>ACTIVAR NOTIFICACIONES</Text></Pressable>}</View>
          {(!supabaseConfigured || (!data.onboarding?.answers && data.profile.name === 'Marc')) && <View style={styles.nutritionCard}><Pressable style={styles.nutritionHeader} onPress={()=>setNutritionOpen(open=>!open)}><View style={{flex:1}}><Text style={styles.eyebrow}>PROPUESTA NUTRICIONAL</Text><Text style={styles.cardTitleLarge}>Nutrición</Text><Text style={styles.mutedSmall}>Estimaciones del documento personal · no mediciones</Text></View><Text style={styles.chevron}>{nutritionOpen?'−':'+'}</Text></Pressable>{nutritionOpen && <><View style={styles.nutritionSummary}><Text style={styles.nutriBig}>2.850 kcal</Text><Text style={styles.mutedTiny}>Mantenimiento estimado en la ficha; necesita validación con evolución real.</Text></View>{nutritionPlan.map(item=><View key={item.day} style={styles.nutriDay}><Text style={styles.nutriDayTitle}>{item.label}</Text><View style={styles.nutriStats}><Text style={styles.nutriStat}>{item.kcal.toLocaleString('es-ES')} kcal</Text><Text style={styles.nutriStat}>{item.protein} g P</Text><Text style={styles.nutriStat}>{item.carbs} g C</Text><Text style={styles.nutriStat}>{item.fat} g G</Text></View></View>)}<Text style={styles.warningText}>Estas cifras proceden de una propuesta previa y no son una prescripción médica ni un registro de lo que realmente comes.</Text><Text style={styles.mutedSmall}>Preferencias anotadas: no come brócoli, la lactosa no le sienta del todo bien (sin diagnóstico de intolerancia) y prefiere evitar desayunos dulces y abundantes.</Text></>}</View>}
          {supabaseConfigured && authUser ? <View style={styles.settingsCard}><Text style={styles.sectionHeader}>CUENTA PERSONAL</Text><Text style={styles.mutedSmall}>Usuario: {String(authUser.user_metadata?.username ?? authUser.email ?? data.profile.name)} · {cloudStatus==='synced'?'datos sincronizados':cloudStatus==='syncing'?'sincronizando…':cloudStatus==='error'?'error de sincronización':'conectado'}</Text><Pressable style={[styles.secondaryButton,{marginTop:10}]} onPress={()=>void handleSignOut()}><Text style={styles.secondaryButtonText}>CERRAR SESIÓN</Text></Pressable></View> : null}
          <View style={styles.dataNote}><Text style={styles.dataNoteTitle}>Privacidad y almacenamiento</Text><Text style={styles.mutedSmall}>{supabaseConfigured && authUser ? 'Tu perfil y el historial se guardan en tu cuenta privada de Supabase y se sincronizan con este dispositivo. Las claves privadas permanecen en Netlify.' : 'Este sitio está funcionando en modo local porque todavía no se han configurado las cuentas de Supabase. Para que cada persona cree un perfil protegido y sincronizado, configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY y ejecuta supabase/schema.sql.'}</Text></View>
        </ScrollView>}
      </View>
      <Modal visible={finishReviewOpen} animationType="slide" transparent onRequestClose={() => setFinishReviewOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { maxHeight: '92%', paddingBottom: 18 }]}>
            <View style={styles.modalHandle}/>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.eyebrow}>CIERRE DE SESIÓN · REGISTRO REAL</Text>
              <Text style={styles.h1}>¿Cómo te has sentido?</Text>
              <Text style={styles.mutedSmall}>Puntúa cada entrenamiento. Estas respuestas ayudan al entrenador inteligente a ajustar las próximas sesiones.</Text>
              <Text style={styles.fieldLabel}>SENSACIONES GENERALES · OBLIGATORIO</Text>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 5 }}>
                {MOOD_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: reviewDraft.mood === option.value }} onPress={() => setReviewDraft(current => ({ ...current, mood: option.value }))} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: reviewDraft.mood === option.value ? C.accent : C.border, backgroundColor: reviewDraft.mood === option.value ? 'rgba(200,255,66,.1)' : C.bg }}><Text style={{ fontSize: 26 }}>{option.emoji}</Text><Text style={{ fontSize: 8, fontWeight: '800', color: reviewDraft.mood === option.value ? C.accent : C.muted, marginTop: 4, textAlign: 'center' }}>{option.label}</Text></Pressable>)}
              </View>
              <Text style={styles.fieldLabel}>PERCEPCIÓN DEL ESFUERZO (RPE) · 1–10 · OBLIGATORIO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>{Array.from({ length: 10 }, (_, index) => String(index + 1)).map(value => <Pressable key={value} onPress={() => setReviewDraft(current => ({ ...current, rpe: value }))} style={[styles.rirChip, { minWidth: 34, flexGrow: 1 }, reviewDraft.rpe === value && styles.rirChipActive]}><Text style={[styles.rirChipText, reviewDraft.rpe === value && styles.rirChipTextActive]}>{value}</Text></Pressable>)}</View>
              <Text style={styles.fieldLabel}>COMENTARIO (OPCIONAL)</Text>
              <TextInput value={reviewDraft.note} onChangeText={value => setReviewDraft(current => ({ ...current, note: value }))} style={[styles.input, { minHeight: 74, textAlignVertical: 'top' }]} multiline placeholder="Técnica, molestias, sensaciones o cualquier detalle…" placeholderTextColor={C.muted}/>
              <Text style={[styles.sectionHeader, { marginTop: 22 }]}>MÉTRICAS DE LA SESIÓN · SI ESTÁN DISPONIBLES EN GARMIN</Text>
              <Text style={styles.mutedTiny}>Introduce los datos del resumen del reloj. No hace falta rellenar los campos que no correspondan a esta actividad.</Text>
              {([
                ['avgHrBpm','Frecuencia cardíaca media (bpm)','Ej. 148'], ['maxHrBpm','Frecuencia cardíaca máxima (bpm)','Ej. 182'],
                ['distanceKm','Distancia (km)','Ej. 8,6'], ['elevationGainM','Desnivel positivo (m)','Ej. 420'],
                ['avgSpeedKmh','Velocidad media (km/h)','Ej. 10,4'], ['maxSpeedKmh','Velocidad máxima (km/h)','Ej. 17,2'],
                ['paceMinPerKm','Ritmo medio (min/km)','Ej. 5,25 = 5:15'], ['caloriesKcal','Calorías (kcal)','Ej. 640'],
                ['avgCadenceRpm','Cadencia media (pasos/min en carrera; rpm en ciclismo)','Ej. 168'], ['avgPowerW','Potencia media (W)','Ej. 215'],
              ] as Array<[MetricDraftKey, string, string]>).map(([key,label,placeholder]) => <View key={key}><Text style={styles.fieldLabel}>{label.toUpperCase()}</Text><TextInput value={String(reviewDraft[key] ?? '')} onChangeText={value => setReviewDraft(current => ({ ...current, [key]: value }))} keyboardType="decimal-pad" style={styles.input} placeholder={placeholder} placeholderTextColor={C.muted}/></View>)}
              <View style={styles.dataNote}><Text style={styles.dataNoteTitle}>Cómo se utilizarán estos datos</Text><Text style={styles.mutedSmall}>Las sensaciones y el RPE se combinarán con cargas, repeticiones y recuperación. La distancia, FC, desnivel, velocidad, ritmo, calorías, cadencia y potencia ayudan a contextualizar las sesiones de trail y ciclismo; no se interpretan aisladamente como diagnóstico.</Text></View>
              <View style={styles.modalButtons}><Pressable onPress={() => setFinishReviewOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>VOLVER A SESIÓN</Text></Pressable><Pressable onPress={saveFinalizedSession} style={styles.finishButton}><Text style={styles.finishText}>GUARDAR Y FINALIZAR</Text></Pressable></View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={!!dialog} animationType="fade" transparent onRequestClose={() => setDialog(null)}>
        <View style={styles.dialogBackdrop}><View style={styles.dialogCard}><View style={styles.dialogMark}><Text style={styles.dialogMarkText}>{dialog?.destructive ? '!' : 'MT'}</Text></View><Text style={styles.dialogTitle}>{dialog?.title}</Text><Text style={styles.dialogMessage}>{dialog?.message}</Text><View style={styles.dialogButtons}>{dialog?.cancelLabel ? <Pressable accessibilityRole="button" onPress={()=>setDialog(null)} style={styles.dialogCancel}><Text style={styles.dialogCancelText}>{dialog.cancelLabel.toUpperCase()}</Text></Pressable> : null}<Pressable accessibilityRole="button" onPress={()=>{ const action=dialog?.onConfirm; setDialog(null); if (action) Promise.resolve(action()).catch(()=>showInfo('No se pudo completar la acción','Vuelve a intentarlo.')); }} style={[styles.dialogConfirm,dialog?.destructive&&styles.dialogConfirmDestructive]}><Text style={styles.dialogConfirmText}>{dialog?.confirmLabel ?? 'ENTENDIDO'}</Text></Pressable></View></View></View>
      </Modal>
      <Modal visible={navMenuOpen} animationType="fade" transparent onRequestClose={() => setNavMenuOpen(false)}>
        <View style={styles.navMenuOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" style={styles.navMenuScrim} onPress={() => setNavMenuOpen(false)} />
          <View style={styles.navMenuCard}>
            <View style={styles.navMenuHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>MY TRAINING LAB</Text>
                <Text style={styles.navMenuTitle}>¿Adónde vamos?</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setNavMenuOpen(false)} style={styles.navMenuClose}>
                <Text style={styles.navMenuCloseText}>×</Text>
              </Pressable>
            </View>
            {([
              ['inicio', '⌂', 'Inicio', 'Resumen y entrenamiento de hoy'],
              ['plan', '▦', 'Plan', 'Calendario y sesiones programadas'],
              ['sesion', '▶', 'Sesión', data.activeSession ? 'Volver al entrenamiento en curso' : 'Empezar o consultar una sesión'],
              ['progreso', '↗', 'Progreso', 'Historial, estadísticas y mediciones'],
              ['recuperacion', '♥', 'Recuperación', 'Editar registros y analizar sueño y fatiga'],
              ['coach', '✦', 'Mi entrenador IA', 'Chat personalizado y ajustes de tu plan'],
              ['perfil', '◉', 'Perfil', 'Datos personales, recordatorios y nutrición'],
            ] as [Tab, string, string, string][]).map(([id, icon, label, description]) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === id }}
                onPress={() => { setTab(id); setNavMenuOpen(false); }}
                style={[styles.navMenuOption, tab === id && styles.navMenuOptionActive]}
              >
                <View style={[styles.navMenuOptionIconBox, tab === id && styles.navMenuOptionIconBoxActive]}>
                  <Text style={[styles.navMenuOptionIcon, tab === id && styles.navMenuOptionIconActive]}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.navMenuOptionTitle, tab === id && styles.navMenuOptionTitleActive]}>{label}</Text>
                  <Text style={styles.navMenuOptionDescription}>{description}</Text>
                </View>
                {tab === id && <View style={styles.navMenuSelectedDot} />}
                <Text style={styles.navMenuChevron}>›</Text>
              </Pressable>
            ))}
            <Text style={styles.navMenuFooter}>NAVEGACIÓN PRINCIPAL</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={setModalOpen} animationType="slide" transparent onRequestClose={()=>setSetModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}><View style={styles.modalCard}><View style={styles.modalHandle}/><Text style={styles.eyebrow}>REGISTRO REAL</Text><Text style={styles.h1}>Serie completada.</Text><Text style={styles.mutedSmall}>{activeExercise?.name} · Serie {(activeExercise ? (data.activeSession?.sets[activeExercise.id]?.length ?? 0) : 0)+1}</Text><Text style={styles.fieldLabel}>PESO UTILIZADO (KG) · DEJA VACÍO SI ES PESO CORPORAL</Text><TextInput value={modalWeight} onChangeText={setModalWeight} keyboardType="decimal-pad" style={styles.inputBig} placeholder="Ej. 12,5" placeholderTextColor={C.muted}/><Text style={styles.fieldLabel}>REPETICIONES COMPLETADAS</Text><TextInput value={modalReps} onChangeText={setModalReps} keyboardType="number-pad" style={styles.inputBig} placeholder="Ej. 10" placeholderTextColor={C.muted}/><Text style={styles.fieldLabel}>RIR · REPETICIONES EN RESERVA (OPCIONAL)</Text><View style={styles.rirRow}>{['0','1','2','3','4','5',''].map(v=><Pressable key={v||'skip'} style={[styles.rirChip,modalRir===v&&styles.rirChipActive]} onPress={()=>setModalRir(v)}><Text style={[styles.rirChipText,modalRir===v&&styles.rirChipTextActive]}>{v||'—'}</Text></Pressable>)}</View><View style={styles.modalButtons}><Pressable onPress={()=>setSetModalOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable onPress={recordSet} style={styles.finishButton}><Text style={styles.finishText}>GUARDAR SERIE</Text></Pressable></View></View></KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({label,value,footer}:{label:string;value:string;footer:string}) { return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statFooter}>{footer}</Text></View>; }
function SectionTitle({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}) { return <View style={styles.sectionTitleRow}><Text style={styles.sectionHeader}>{title}</Text>{action&&onAction&&<Pressable onPress={onAction}><Text style={styles.sectionAction}>{action} ↗</Text></Pressable>}</View>; }
function Notice({text}:{text:string}) { return <View style={styles.notice}><Text style={styles.noticeMark}>i</Text><Text style={styles.noticeText}>{text}</Text></View>; }
function MetricBox({label,value}:{label:string;value:string}) { return <View style={styles.metricBox}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function ExerciseRow({exercise,index,compact}:{exercise:Exercise;index:number;compact?:boolean}) { return <View style={[styles.exerciseRow,compact&&styles.exerciseRowCompact]}><View style={styles.exerciseThumb}>{exerciseImageSource(exercise.id, exercise.name) ? <Image source={exerciseImageSource(exercise.id, exercise.name)} style={{width:44,height:44,borderRadius:12}} resizeMode="cover"/> : <Text style={styles.exerciseThumbIcon}>🏋️</Text>}</View><View style={{flex:1}}><Text style={styles.exerciseRowTitle}>{index+1}. {exercise.name}</Text><Text style={styles.mutedTiny}>{exercise.sets} × {exercise.reps} · {formatRest(exercise.restSeconds)} descanso</Text><Text style={styles.exerciseRowLoad}>{exercise.weightKg === undefined ? 'Carga pendiente / peso corporal' : `${exercise.adjustmentNote ? 'Recomendado' : 'Propuesta'}: ${kgText(exercise.weightKg)}`}</Text>{exercise.adjustmentNote ? <Text style={styles.mutedTiny}>{exercise.adjustmentNote}</Text> : null}</View><Text style={styles.chevron}>›</Text></View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},loading:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:12},
  topBar:{height:70,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderBottomColor:C.border},brandMark:{width:40,height:40,borderRadius:13,backgroundColor:C.accent,alignItems:'center',justifyContent:'center'},brandMarkText:{fontWeight:'900',fontSize:16,color:C.bg,letterSpacing:-1},brand:{fontWeight:'900',fontSize:13,color:C.text,letterSpacing:1.5},brandSub:{fontSize:8,color:C.muted,letterSpacing:1.15,marginTop:3},statusDot:{height:8,width:8,borderRadius:8,backgroundColor:C.accent},content:{flex:1},screenPad:{paddingHorizontal:18,paddingTop:22,paddingBottom:25},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.65,color:C.accent,marginBottom:8},h1:{fontSize:29,fontWeight:'900',color:C.text,letterSpacing:-.8,lineHeight:34,marginBottom:7},muted:{fontSize:13,color:C.muted},mutedSmall:{fontSize:11,color:C.muted},mutedTiny:{fontSize:9,color:C.muted,lineHeight:14},
  heroCard:{marginTop:22,backgroundColor:C.surface,borderRadius:22,padding:19,borderWidth:1,borderColor:C.border},heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},pill:{backgroundColor:'rgba(200,255,66,0.12)',borderRadius:50,paddingHorizontal:10,paddingVertical:6},pillText:{fontSize:8,fontWeight:'900',letterSpacing:1,color:C.accent},heroTime:{fontSize:10,fontWeight:'800',color:C.muted},heroTitle:{fontSize:30,fontWeight:'900',color:C.text,marginTop:16,letterSpacing:-.7},heroSub:{fontSize:13,color:C.muted,marginTop:4},rowMeta:{flexDirection:'row',justifyContent:'space-between',marginTop:18},metaText:{color:C.text,fontSize:10,fontWeight:'700'},heroRule:{height:1,backgroundColor:C.border,marginVertical:15},primaryButton:{height:52,backgroundColor:C.accent,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:17,paddingHorizontal:14},primaryButtonText:{fontSize:11,fontWeight:'900',letterSpacing:.8,color:C.bg},arrow:{fontSize:15},
  statRow:{flexDirection:'row',gap:10,marginTop:12},statCard:{flex:1,backgroundColor:C.surface,borderRadius:17,padding:14,borderWidth:1,borderColor:C.border,minHeight:100},statLabel:{fontSize:8,fontWeight:'900',letterSpacing:1,color:C.muted},statValue:{fontSize:24,fontWeight:'900',color:C.text,marginTop:9,letterSpacing:-.6},statFooter:{fontSize:9,color:C.muted,marginTop:5},resumeCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.surface2,borderRadius:15,padding:14,marginTop:12,borderWidth:1,borderColor:C.border},resumeIcon:{width:36,height:36,borderRadius:12,backgroundColor:C.accent,alignItems:'center',justifyContent:'center'},cardTitle:{color:C.text,fontSize:13,fontWeight:'800'},chevron:{fontSize:23,color:C.muted,marginLeft:5},sectionTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:23,marginBottom:12},sectionHeader:{fontSize:10,color:C.text,fontWeight:'900',letterSpacing:1.3},sectionAction:{fontSize:10,color:C.accent,fontWeight:'800'},weekList:{gap:7},weekItem:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:15,padding:10},weekItemActive:{borderColor:C.accent},dayBubble:{height:34,width:34,borderRadius:11,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'},dayBubbleText:{fontSize:11,fontWeight:'900',color:C.muted},dayBubbleTextActive:{color:C.accent},weekTitle:{fontSize:12,fontWeight:'800',color:C.text},weekSub:{fontSize:9,color:C.muted,marginTop:2},weekTime:{fontSize:10,fontWeight:'900',color:C.muted},notice:{flexDirection:'row',gap:10,marginTop:18,padding:12,backgroundColor:'rgba(143,185,255,.07)',borderRadius:13,borderWidth:1,borderColor:'rgba(143,185,255,.18)'},noticeMark:{width:17,height:17,borderRadius:9,textAlign:'center',textAlignVertical:'center',overflow:'hidden',fontSize:11,fontWeight:'900',color:C.blue,borderWidth:1,borderColor:C.blue},noticeText:{flex:1,color:C.muted,fontSize:10,lineHeight:16},
  blockCard:{backgroundColor:C.surface,borderRadius:17,padding:14,borderWidth:1,borderColor:C.border,marginTop:16},blockTop:{flexDirection:'row',alignItems:'flex-start',gap:8},blockTitle:{fontSize:15,color:C.text,fontWeight:'900',lineHeight:20},blockBadge:{paddingHorizontal:9,paddingVertical:7,borderRadius:9,backgroundColor:'rgba(200,255,66,.12)'},blockBadgeText:{fontSize:8,fontWeight:'900',color:C.accent,letterSpacing:.6},blockTrack:{height:5,backgroundColor:C.surface2,borderRadius:5,overflow:'hidden',marginVertical:11},blockFill:{height:'100%',backgroundColor:C.accent,borderRadius:5},recoveryInline:{fontSize:9,fontWeight:'900',marginTop:10,letterSpacing:.6},
  monthHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22,marginBottom:13},monthName:{color:C.text,fontWeight:'900',fontSize:12,letterSpacing:1.1},monthArrow:{height:33,width:33,borderRadius:11,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'},monthArrowText:{color:C.text,fontSize:22,marginTop:-2},calendarGrid:{flexDirection:'row',flexWrap:'wrap',borderRadius:16,backgroundColor:C.surface,paddingVertical:9,paddingHorizontal:5,borderWidth:1,borderColor:C.border},calendarWeekday:{width:'14.2857%',textAlign:'center',fontSize:9,fontWeight:'900',color:C.muted,marginBottom:8},calendarCell:{width:'14.2857%',height:43,alignItems:'center',justifyContent:'center',borderRadius:11},calendarCellEmpty:{width:'14.2857%',height:43},calendarCellSelected:{backgroundColor:C.accent},calendarCellToday:{borderWidth:1,borderColor:C.accent},calendarDayText:{fontSize:11,fontWeight:'700',color:C.text},calendarDayTextSelected:{color:C.bg,fontWeight:'900'},calendarDot:{height:4,width:4,borderRadius:4,marginTop:3},dotStrength:{backgroundColor:C.accent},dotEndurance:{backgroundColor:C.blue},dotRecovery:{backgroundColor:C.warning},selectedDayCard:{backgroundColor:C.surface,borderRadius:20,padding:15,borderWidth:1,borderColor:C.border,marginTop:15},selectedHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8},cardTitleLarge:{fontSize:20,fontWeight:'900',color:C.text,letterSpacing:-.4},legendRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:14},legendDot:{height:7,width:7,borderRadius:7,marginLeft:7},
  exerciseRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.border},exerciseRowCompact:{paddingVertical:10},exerciseThumb:{width:44,height:44,borderRadius:13,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'},exerciseThumbIcon:{fontSize:18},exerciseRowTitle:{fontSize:11,fontWeight:'800',color:C.text,lineHeight:16},exerciseRowLoad:{fontSize:9,color:C.accent,marginTop:4,fontWeight:'700'},
  emptyState:{minHeight:440,alignItems:'center',justifyContent:'center',paddingHorizontal:18},emptySymbol:{height:72,width:72,borderRadius:25,backgroundColor:'rgba(200,255,66,.12)',alignItems:'center',justifyContent:'center',marginBottom:22},sessionProgress:{backgroundColor:C.surface,borderRadius:15,borderWidth:1,borderColor:C.border,padding:14,marginTop:17},progressLabelRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},progressNum:{fontSize:15,fontWeight:'900',color:C.accent},progressTrack:{height:6,borderRadius:5,backgroundColor:C.surface2,marginVertical:10,overflow:'hidden'},progressFill:{height:'100%',borderRadius:5,backgroundColor:C.accent},exerciseHero:{marginTop:16,backgroundColor:C.surface,borderRadius:20,borderWidth:1,borderColor:C.border,overflow:'hidden'},exerciseVisual:{height:155,backgroundColor:'#202B39',alignItems:'center',justifyContent:'center'},dumbbellGlyph:{fontSize:47},visualLabel:{fontSize:8,color:C.accent,fontWeight:'900',letterSpacing:1.2,marginTop:5},visualSub:{fontSize:9,color:C.muted,marginTop:3},exerciseHeroTitle:{padding:15},cardTitleXL:{fontSize:23,fontWeight:'900',color:C.text,letterSpacing:-.5,lineHeight:28},warningBanner:{backgroundColor:'rgba(255,197,107,.1)',borderWidth:1,borderColor:'rgba(255,197,107,.28)',padding:12,borderRadius:13,marginTop:12},warningTitle:{fontSize:9,fontWeight:'900',letterSpacing:1,color:C.warning,marginBottom:5},warningText:{fontSize:10,lineHeight:15,color:C.muted},mainMetrics:{flexDirection:'row',gap:8,marginTop:12},metricBox:{flex:1,backgroundColor:C.surface,borderRadius:13,padding:10,borderWidth:1,borderColor:C.border,minHeight:66},metricLabel:{fontSize:7,fontWeight:'900',letterSpacing:.7,color:C.muted},metricValue:{fontSize:14,fontWeight:'900',color:C.text,marginTop:9},setsCard:{backgroundColor:C.surface,borderRadius:16,padding:13,borderWidth:1,borderColor:C.border,marginTop:13},setRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},setRowDone:{opacity:.92},setNumber:{width:27,height:27,borderRadius:9,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'},setNumberDone:{backgroundColor:'rgba(139,238,181,.15)'},setNumberText:{color:C.muted,fontSize:10,fontWeight:'900'},setNumberTextDone:{color:C.green},setName:{fontSize:11,fontWeight:'800',color:C.text},setDetail:{fontSize:9,color:C.muted,marginTop:3},setState:{fontSize:8,fontWeight:'900',color:C.muted},restCard:{alignItems:'center',backgroundColor:'rgba(200,255,66,.07)',borderWidth:1,borderColor:'rgba(200,255,66,.2)',borderRadius:17,padding:16,marginTop:13},timer:{fontSize:51,fontWeight:'900',color:C.accent,letterSpacing:-1,marginVertical:4,fontVariant:['tabular-nums']},restControls:{flexDirection:'row',gap:8,marginTop:14},smallOutlineButton:{borderWidth:1,borderColor:C.border,borderRadius:10,paddingHorizontal:15,paddingVertical:9},smallOutlineText:{fontSize:10,color:C.text,fontWeight:'800'},successBanner:{backgroundColor:'rgba(139,238,181,.08)',borderWidth:1,borderColor:'rgba(139,238,181,.2)',borderRadius:13,padding:13,marginTop:12},successTitle:{fontSize:12,fontWeight:'900',color:C.green},successText:{fontSize:10,color:C.muted,marginTop:4,lineHeight:15},exerciseNotes:{fontSize:10,color:C.muted,lineHeight:16,marginTop:12},sessionFooter:{flexDirection:'row',gap:9,marginTop:22,marginBottom:12},cancelButton:{height:48,borderRadius:13,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',paddingHorizontal:16},cancelText:{fontSize:10,fontWeight:'800',color:C.muted},finishButton:{height:48,borderRadius:13,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',paddingHorizontal:17,flex:1,borderWidth:1,borderColor:C.border},finishText:{fontSize:10,fontWeight:'900',color:C.text,letterSpacing:.6},activityCard:{backgroundColor:C.surface,borderRadius:18,borderWidth:1,borderColor:C.border,padding:17,marginTop:15},activityTimer:{fontSize:37,color:C.accent,fontWeight:'900',marginVertical:16},
  emptyCard:{backgroundColor:C.surface,borderRadius:16,padding:18,borderWidth:1,borderColor:C.border},deleteHistoryButton:{alignSelf:'flex-start',borderWidth:1,borderColor:'rgba(255,120,120,.35)',backgroundColor:'rgba(255,120,120,.07)',borderRadius:10,paddingHorizontal:12,paddingVertical:9,marginTop:12},deleteHistoryText:{fontSize:9,fontWeight:'900',letterSpacing:.5,color:C.red},recoveryForm:{backgroundColor:C.surface,borderRadius:18,padding:15,borderWidth:1,borderColor:C.border,marginTop:17},recoveryImageWrap:{alignItems:'center',padding:10,marginTop:10,backgroundColor:C.bg,borderRadius:14,borderWidth:1,borderColor:C.border},recoveryImage:{width:'100%',height:230},recoveryHistoryCard:{backgroundColor:C.surface,borderRadius:17,padding:14,borderWidth:1,borderColor:C.border,marginBottom:10},recoveryHistoryImage:{width:'100%',height:200,marginVertical:10,backgroundColor:C.bg,borderRadius:12},recoveryStatusText:{fontSize:9,fontWeight:'900',letterSpacing:.5},emptyCardTitle:{fontSize:13,color:C.text,fontWeight:'800',marginBottom:8},historyCard:{backgroundColor:C.surface,borderRadius:16,padding:14,borderWidth:1,borderColor:C.border,marginBottom:9},historyHead:{flexDirection:'row',alignItems:'center'},historyVolume:{fontSize:14,color:C.accent,fontWeight:'900'},historySub:{fontSize:10,color:C.text,marginVertical:8},
  profileForm:{backgroundColor:C.surface,borderRadius:18,borderWidth:1,borderColor:C.border,padding:15,marginTop:18},fieldLabel:{fontSize:8,fontWeight:'900',letterSpacing:1,color:C.muted,marginTop:13,marginBottom:7},input:{height:44,borderRadius:11,borderWidth:1,borderColor:C.border,backgroundColor:C.bg,paddingHorizontal:12,color:C.text,fontSize:13},formRow:{flexDirection:'row',gap:10},settingsCard:{backgroundColor:C.surface,borderRadius:17,borderWidth:1,borderColor:C.border,padding:14,marginTop:12},settingRow:{flexDirection:'row',alignItems:'center',marginBottom:10},reminderStatus:{fontSize:8,fontWeight:'900',letterSpacing:.7},secondaryButton:{height:43,borderRadius:12,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'},secondaryButtonText:{fontSize:10,color:C.text,fontWeight:'800'},nutritionCard:{backgroundColor:C.surface,borderRadius:17,borderWidth:1,borderColor:C.border,padding:15,marginTop:12},nutritionHeader:{flexDirection:'row',alignItems:'center'},nutritionSummary:{backgroundColor:C.surface2,borderRadius:12,padding:12,marginTop:13},nutriBig:{fontSize:23,fontWeight:'900',color:C.text,marginBottom:5},nutriDay:{paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},nutriDayTitle:{fontSize:11,fontWeight:'900',color:C.text,marginBottom:7},nutriStats:{flexDirection:'row',flexWrap:'wrap',gap:8},nutriStat:{fontSize:9,fontWeight:'800',color:C.accent},dataNote:{padding:14,marginTop:12,borderRadius:14,borderWidth:1,borderColor:C.border},dataNoteTitle:{fontSize:11,fontWeight:'900',color:C.text,marginBottom:6},
  bodyTrendCard:{backgroundColor:C.surface,borderRadius:17,borderWidth:1,borderColor:C.border,padding:14},bodyTrendRow:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border},bodyBarTrack:{height:5,backgroundColor:C.surface2,borderRadius:5,overflow:'hidden',marginTop:8,marginBottom:6},bodyBarFill:{height:'100%',borderRadius:5,backgroundColor:C.accent},
  coachCard:{backgroundColor:C.surface,borderRadius:18,borderWidth:1,borderColor:C.border,padding:15,marginTop:16},aiReportCard:{backgroundColor:C.bg,borderRadius:14,borderWidth:1,borderColor:C.border,padding:13,marginTop:14},aiReportText:{fontSize:12,color:C.text,lineHeight:19,marginTop:9},aiSuggestionRow:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border,gap:4},sessionFeedbackCard:{backgroundColor:C.bg,borderRadius:12,borderWidth:1,borderColor:C.border,padding:11,marginTop:10,gap:6},sessionFeedbackRow:{flexDirection:'row',alignItems:'center',gap:10},
  baselineCard:{backgroundColor:C.surface,borderRadius:17,borderWidth:1,borderColor:C.border,padding:14,marginTop:12},baselineGrid:{flexDirection:'row',gap:8,marginTop:10},referenceRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},referenceName:{fontSize:11,color:C.text,fontWeight:'800',marginBottom:4},referenceLoad:{fontSize:12,color:C.accent,fontWeight:'900'},
  navMenuTrigger:{height:39,minWidth:65,paddingHorizontal:11,borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},navMenuTriggerIcon:{fontSize:15,color:C.accent,fontWeight:'900'},navMenuTriggerText:{fontSize:9,fontWeight:'900',color:C.text,letterSpacing:.7},
  navMenuOverlay:{flex:1,justifyContent:'flex-start',alignItems:'flex-end',paddingTop:124,paddingHorizontal:14,backgroundColor:'rgba(0,0,0,.38)'},navMenuScrim:{...StyleSheet.absoluteFillObject},navMenuCard:{width:'100%',maxWidth:390,backgroundColor:C.surface,borderRadius:22,borderWidth:1,borderColor:C.border,padding:16,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:.32,shadowRadius:22,elevation:14},navMenuHeader:{flexDirection:'row',alignItems:'center',marginBottom:14,paddingHorizontal:2},navMenuTitle:{fontSize:22,color:C.text,fontWeight:'900',letterSpacing:-.5,marginTop:4},navMenuClose:{width:36,height:36,borderRadius:12,backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},navMenuCloseText:{fontSize:25,color:C.muted,lineHeight:27},navMenuOption:{flexDirection:'row',alignItems:'center',gap:12,padding:11,borderRadius:15,borderWidth:1,borderColor:'transparent',marginTop:5,minHeight:65},navMenuOptionActive:{backgroundColor:'rgba(200,255,66,.08)',borderColor:'rgba(200,255,66,.28)'},navMenuOptionIconBox:{width:40,height:40,borderRadius:12,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'},navMenuOptionIconBoxActive:{backgroundColor:C.accent},navMenuOptionIcon:{fontSize:20,color:C.muted},navMenuOptionIconActive:{color:C.bg},navMenuOptionTitle:{fontSize:14,fontWeight:'900',color:C.text},navMenuOptionTitleActive:{color:C.accent},navMenuOptionDescription:{fontSize:10,color:C.muted,marginTop:3,lineHeight:14},navMenuSelectedDot:{width:6,height:6,borderRadius:3,backgroundColor:C.accent},navMenuChevron:{fontSize:23,color:C.muted,marginLeft:2},navMenuFooter:{fontSize:8,letterSpacing:1.6,color:C.muted,fontWeight:'900',marginTop:15,marginLeft:5},
  dialogBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.72)',alignItems:'center',justifyContent:'center',padding:22},dialogCard:{width:'100%',maxWidth:440,backgroundColor:C.surface,borderRadius:22,borderWidth:1,borderColor:C.border,padding:22},dialogMark:{width:42,height:42,borderRadius:13,backgroundColor:'rgba(200,255,66,.14)',alignItems:'center',justifyContent:'center',marginBottom:15},dialogMarkText:{color:C.accent,fontSize:13,fontWeight:'900'},dialogTitle:{fontSize:22,fontWeight:'900',color:C.text,letterSpacing:-.3},dialogMessage:{fontSize:13,color:C.muted,lineHeight:20,marginTop:9},dialogButtons:{flexDirection:'row',gap:9,marginTop:22},dialogCancel:{height:46,flex:1,borderRadius:12,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},dialogCancelText:{color:C.muted,fontSize:10,fontWeight:'900'},dialogConfirm:{height:46,flex:1.2,borderRadius:12,backgroundColor:C.accent,alignItems:'center',justifyContent:'center',paddingHorizontal:10},dialogConfirmDestructive:{backgroundColor:C.red},dialogConfirmText:{fontSize:10,fontWeight:'900',letterSpacing:.4,color:C.bg},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.72)',justifyContent:'flex-end'},modalCard:{backgroundColor:C.surface,borderTopLeftRadius:25,borderTopRightRadius:25,borderTopWidth:1,borderColor:C.border,padding:22,paddingBottom:30},modalHandle:{width:42,height:4,backgroundColor:C.border,borderRadius:4,alignSelf:'center',marginBottom:22},inputBig:{height:50,borderRadius:13,borderWidth:1,borderColor:C.border,backgroundColor:C.bg,paddingHorizontal:14,color:C.text,fontSize:18,fontWeight:'800'},rirRow:{flexDirection:'row',gap:7,marginTop:2},rirChip:{flex:1,height:38,borderRadius:10,backgroundColor:C.bg,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},rirChipActive:{backgroundColor:C.accent,borderColor:C.accent},rirChipText:{fontSize:12,fontWeight:'900',color:C.muted},rirChipTextActive:{color:C.bg},modalButtons:{flexDirection:'row',gap:10,marginTop:22},
});
