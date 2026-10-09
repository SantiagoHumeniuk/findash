export const PROFILE_AVATAR_OPTIONS = [1, 2, 3] as const;

/** Returns the stored avatar choice or a stable per-user default. */
export function getProfileAvatarIndex(userId: string, selectedAvatar?: unknown): number {
  const avatarIndex = typeof selectedAvatar === 'string' ? Number(selectedAvatar) : selectedAvatar;
  if (typeof avatarIndex === 'number' && PROFILE_AVATAR_OPTIONS.includes(avatarIndex as 1 | 2 | 3)) {
    return avatarIndex;
  }

  const hash = [...userId].reduce((value, character) => (value * 31 + character.charCodeAt(0)) | 0, 0);
  return (Math.abs(hash) % PROFILE_AVATAR_OPTIONS.length) + 1;
}

/** Returns a private uploaded image when present, otherwise a bundled avatar option. */
export function getProfileAvatarUrl(avatarIndex: number, avatarImage?: unknown): string {
  if (typeof avatarImage === 'string' && /^data:image\/(webp|png);base64,[A-Za-z0-9+/]+=*$/.test(avatarImage)) {
    return avatarImage;
  }
  return `/avatars/avatar-${avatarIndex}.png`;
}