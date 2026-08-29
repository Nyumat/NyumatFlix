export function isLikelyMultiMoviePack(nameBlob: string): boolean {
  const n = nameBlob.toLowerCase();
  if (
    /\b(trilogy|duology|quadrilogy|collection|anthology|complete\s*(?:series|collection|saga|set)?|box\s*set|movie\s*pack|film\s*pack|marathon|pack)\b/.test(
      n,
    )
  ) {
    return true;
  }
  const years = n.match(/\b(19\d{2}|20\d{2})\b/g) ?? [];
  return new Set(years).size >= 2;
}
