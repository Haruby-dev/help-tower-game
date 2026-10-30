import th from '../i18n/th.json';

export type TextKey = keyof typeof th;

export function t(key: TextKey): string {
  return th[key];
}
