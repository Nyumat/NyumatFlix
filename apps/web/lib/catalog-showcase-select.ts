const normalizeShowcaseTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const titleTokens = (title: string) =>
  normalizeShowcaseTitle(title)
    .split(" ")
    .filter((token) => token.length > 2);

export const matchShowcaseRowId = (
  rows: Array<{ rowId: string; title: string }>,
  previousTitle?: string,
): string | undefined => {
  const firstRowId = rows[0]?.rowId;
  if (!previousTitle) {
    return firstRowId;
  }

  const needle = normalizeShowcaseTitle(previousTitle);
  const exact = rows.find(
    (row) => normalizeShowcaseTitle(row.title) === needle,
  );
  if (exact) {
    return exact.rowId;
  }

  const previousTokens = titleTokens(previousTitle);
  const scored = rows
    .map((row) => {
      const tokens = titleTokens(row.title);
      const overlap = tokens.filter((token) =>
        previousTokens.some(
          (previous) => token.includes(previous) || previous.includes(token),
        ),
      ).length;
      return { row, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  return scored[0]?.row.rowId ?? firstRowId;
};
