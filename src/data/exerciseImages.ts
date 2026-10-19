// Local exercise-guide illustrations bundled with the app for offline viewing.
// Illustrations are visual references, not a substitute for each exercise's technique notes.
const images: Record<string, any> = {
  'mon-incline-db': require('../../assets/exercises/01-incline-db-press.jpg'),
  'mon-bench': require('../../assets/exercises/02-barbell-bench-press.jpg'),
  'mon-lateral-db': require('../../assets/exercises/03-lateral-raise.jpg'),
  'mon-crossover': require('../../assets/exercises/04-cable-fly.jpg'),
  'mon-triceps-overhead': require('../../assets/exercises/05-overhead-triceps-extension.jpg'),
  'tue-pullup': require('../../assets/exercises/06-pull-up.jpg'),
  'tue-row-chest': require('../../assets/exercises/07-chest-supported-row.jpg'),
  'tue-pullover': require('../../assets/exercises/14-lat-pulldown.jpg'),
  'tue-facepull': require('../../assets/exercises/09-face-pull.jpg'),
  'tue-incline-curl': require('../../assets/exercises/10-incline-db-curl.jpg'),
  'thu-shoulder-press': require('../../assets/exercises/11-seated-shoulder-press.jpg'),
  'thu-barbell-row': require('../../assets/exercises/12-barbell-row.jpg'),
  'thu-smith-incline': require('../../assets/exercises/13-smith-incline-press.jpg'),
  'thu-neutral-pulldown': require('../../assets/exercises/14-lat-pulldown.jpg'),
  'thu-cable-lateral': require('../../assets/exercises/03-lateral-raise.jpg'),
  'thu-dips': require('../../assets/exercises/15-parallel-dip.jpg'),
  'thu-ez-curl': require('../../assets/exercises/16-ez-bar-curl.jpg'),
  'fri-lateral-db': require('../../assets/exercises/03-lateral-raise.jpg'),
  'fri-preacher-curl': require('../../assets/exercises/10-incline-db-curl.jpg'),
  'fri-french-press': require('../../assets/exercises/05-overhead-triceps-extension.jpg'),
  'fri-hammer-curl': require('../../assets/exercises/16-ez-bar-curl.jpg'),
  'fri-rope-pushdown': require('../../assets/exercises/08-triceps-pushdown.jpg'),
  'fri-rear-delt': require('../../assets/exercises/09-face-pull.jpg'),
  'fri-shrugs': require('../../assets/exercises/12-barbell-row.jpg'),
};

export function exerciseImageSource(id: string, exerciseName = ''): any {
  if (images[id]) return images[id];
  const name = exerciseName.toLowerCase();
  if (/dominada|pull.?up/.test(name)) return images['tue-pullup'];
  if (/press.*inclinado|incline.*press/.test(name)) return images['mon-incline-db'];
  if (/press.*banca|press.*barra|bench press/.test(name)) return images['mon-bench'];
  if (/press militar|shoulder press|press.*hombro/.test(name)) return images['thu-shoulder-press'];
  if (/remo|row/.test(name)) return images['tue-row-chest'];
  if (/jal[oó]n|pulldown|pullover/.test(name)) return images['thu-neutral-pulldown'];
  if (/face pull/.test(name)) return images['tue-facepull'];
  if (/curl|bíceps|biceps/.test(name)) return images['fri-hammer-curl'];
  if (/tr[ií]ceps|franc[eé]s|pushdown|extensi[oó]n de tr[ií]ceps/.test(name)) return images['fri-rope-pushdown'];
  if (/apertura|fly|cruzada/.test(name)) return images['mon-crossover'];
  if (/fondo|dip/.test(name)) return images['thu-dips'];
  if (/lateral|p[aá]jaro|deltoides/.test(name)) return images['mon-lateral-db'];
  return undefined;
}
