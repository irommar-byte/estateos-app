/** Pola profilu dotyczące jednorazowej darmowej publikacji (API camelCase + legacy snake_case). */
export type UserPublicationFlags = {
  firstFreePublicationUsed?: boolean | null;
  first_free_publication_used?: boolean | null;
};

export function readUserFirstFreePublicationUsed(
  user: UserPublicationFlags | null | undefined,
): boolean | null {
  if (!user) return null;
  if (user.firstFreePublicationUsed === true || user.first_free_publication_used === true) return true;
  if (user.firstFreePublicationUsed === false || user.first_free_publication_used === false) return false;
  return null;
}
