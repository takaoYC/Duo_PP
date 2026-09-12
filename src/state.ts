export type CardTheme = 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large';
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const wrapIndex = (index: number, length: number) => (index % length + length) % length;
export const messageOpacity = (fold: number) => clamp((fold - 85) / 15, 0, 1);
function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function savePreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Private/restricted storage must not interrupt reading. */ }
}
const theme = read('duo-pp:theme');
const size = read('duo-pp:font');
export const state = {
  foldProgress: 0,
  phoneRotation: -12,
  phoneTilt: 3,
  currentCard: 0,
  cardTheme: (theme === 'dark' ? 'dark' : 'light') as CardTheme,
  fontSize: (['small', 'medium', 'large'].includes(size ?? '') ? size : 'medium') as FontSize,
};
