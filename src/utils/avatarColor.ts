const AVATAR_COLOR_COUNT = 5;

export function getAvatarColor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return `var(--avatar-color-${sum % AVATAR_COLOR_COUNT})`;
}

export function getAvatarInitial(fullName?: string, username?: string): string {
  const src = fullName?.trim() || username?.trim() || '?';
  return src[0].toUpperCase();
}
