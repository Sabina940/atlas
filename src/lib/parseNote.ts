export function parseNote(raw: string) {
  const lines = raw.split("\n");
  const get = (key: string) => {
    const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ":"));
    return line ? line.split(":").slice(1).join(":").trim() : "";
  };

  const title = get("Title") || "Untitled";
  const slug = get("Slug");
  const tags = (get("Tags") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const cover_url = get("Cover") || null;

  // content starts after a line with "---" OR after metadata block
  let content = raw;
  const sep = raw.indexOf("\n---");
  if (sep !== -1) content = raw.slice(sep + 4).trim();

  return { title, slug, tags, cover_url, content_md: content };
}