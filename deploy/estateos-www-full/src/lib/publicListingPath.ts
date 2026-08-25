/** Publiczne karty ogłoszeń — bez auto-escape IAB i bez pollingów tła. */
export function isPublicListingPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || '').split('?')[0];
  return (
    /^\/o\/\d+(\/karta)?\/?$/.test(path) ||
    /^\/oferta\/\d+\/?$/.test(path) ||
    /^\/cars\/\d+\/?$/.test(path)
  );
}
