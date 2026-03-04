export interface ChangelogItem {
  title?: string;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  categories: { name: string; items: ChangelogItem[] }[];
}

export function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let currentCategory: { name: string; items: ChangelogItem[] } | null = null;

  for (const line of raw.split("\n")) {
    // ## [version] - date
    const versionMatch = line.match(/^## \[(.+?)\]\s*-\s*(.+)$/);
    if (versionMatch) {
      if (current) entries.push(current);
      current = { version: versionMatch[1], date: versionMatch[2].trim(), categories: [] };
      currentCategory = null;
      continue;
    }

    if (!current) continue;

    // ### Category
    const categoryMatch = line.match(/^### (.+)$/);
    if (categoryMatch) {
      currentCategory = { name: categoryMatch[1].trim(), items: [] };
      current.categories.push(currentCategory);
      continue;
    }

    // - **title**: description
    const titleItemMatch = line.match(/^- \*\*(.+?)\*\*:\s*(.+)$/);
    if (titleItemMatch && currentCategory) {
      currentCategory.items.push({
        title: titleItemMatch[1].trim(),
        description: titleItemMatch[2].trim(),
      });
      continue;
    }

    // - plain item (fallback)
    const itemMatch = line.match(/^- (.+)$/);
    if (itemMatch && currentCategory) {
      currentCategory.items.push({ description: itemMatch[1].trim() });
    }
  }

  if (current) entries.push(current);
  return entries;
}
