import * as cheerio from "cheerio";

function clip(s: string | undefined, max: number) {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

export function extractMetadata(html: string, finalUrl: URL) {
  const $ = cheerio.load(html);

  const title = clip(
    $('meta[property="og:title"]').attr("content") || $("title").first().text(),
    500,
  );
  const description = clip(
    $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content"),
    1000,
  );

  let faviconUrl: string | null = null;
  const iconHref = $('link[rel~="icon"]').first().attr("href");
  try {
    const icon = new URL(iconHref ?? "/favicon.ico", finalUrl);
    if (["http:", "https:"].includes(icon.protocol)) faviconUrl = icon.toString();
  } catch {
    faviconUrl = null;
  }

  return { title, description, faviconUrl };
}