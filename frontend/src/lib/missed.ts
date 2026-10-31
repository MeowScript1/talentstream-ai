export type Side = 'candidate' | 'employer';

/** What happened in a missed interview, written for whoever is reading (both people see the same facts). */
export function missedMessage(viewer: Side, absent: Side[], otherName: string): string {
  if (absent.length === 2) return 'Neither of you joined this interview.';
  const missing = absent[0];
  if (missing === viewer) return 'You did not join this interview.';
  return viewer === 'candidate'
    ? `${otherName} did not join this interview. This is not counted against you.`
    : `${otherName} did not join this interview.`;
}

/** The next step differs for each side; nothing is rejected automatically. */
export function missedNextStep(viewer: Side): string {
  return viewer === 'employer'
    ? 'You can set a new time, or reject the application.'
    : 'The employer decides the next step: a new time, or no further interview.';
}
