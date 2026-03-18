const AVATAR_COLORS = [
  '#2A7C76', // Warmes Petrol
  '#B8860B', // Warmes Gold
  '#3B82C4', // Hellblau
  '#C4A35A', // Sand
  '#8B1A2F', // Bordeaux
] as const;

export function getAvatarColor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function getAvatarInitial(fullName?: string, username?: string): string {
  const src = fullName?.trim() || username?.trim() || '?';
  return src[0].toUpperCase();
}
