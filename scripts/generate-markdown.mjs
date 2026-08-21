import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";

const root = new URL("../", import.meta.url);
const siteOrigin = "https://logicleaptechnologies.com";
const pages = [
  "index.html",
  "services.html",
  "contact.html",
  "support.html",
  "privacy-policy.html",
  "data-deletion.html",
  "refund-policy.html",
  "security.html",
  "terms.html",
  "404.html"
];

const converter = new NodeHtmlMarkdown({
  bulletMarker: "-",
  codeBlockStyle: "fenced",
  keepDataImages: false,
  useInlineLinks: true
});

function absoluteUrl(value, pageUrl) {
  if (!value || value.startsWith("mailto:") || value.startsWith("tel:")) return value;
  return new URL(value, pageUrl).toString();
}

const fullSite = [];

for (const htmlFile of pages) {
  const html = await readFile(new URL(htmlFile, root), "utf8");
  const $ = cheerio.load(html);
  const canonical = $("link[rel='canonical']").attr("href")
    ?? new URL(htmlFile === "index.html" ? "/" : `/${htmlFile}`, siteOrigin).toString();
  const markdownPath = `/${basename(htmlFile, ".html")}.md`;
  const title = $("main h1").first().text().trim() || $("title").text().split("|")[0].trim();
  const description = $("meta[name='description']").attr("content")?.trim();
  const main = $("main").first().clone();

  main.find("script, style, svg, .stripe, .eyebrow, [data-copy], [data-copy-status], [data-markdown-ignore]").remove();
  main.find("img").each((_, element) => {
    if (!$(element).attr("alt")?.trim()) $(element).remove();
  });
  main.find("h1").first().remove();
  main.find("a[href]").each((_, element) => {
    const link = $(element);
    link.attr("href", absoluteUrl(link.attr("href"), canonical));
  });
  main.find("img[src]").each((_, element) => {
    const image = $(element);
    image.attr("src", absoluteUrl(image.attr("src"), canonical));
  });

  const body = converter.translate(main.html() ?? "").trim();
  const metadata = [
    `# ${title}`,
    description ? `\n> ${description}` : "",
    `\n- Canonical HTML: ${canonical}`,
    `- Markdown: ${new URL(markdownPath, siteOrigin)}`
  ].filter(Boolean).join("\n");
  const output = `${metadata}\n\n${body}\n`;

  await writeFile(new URL(markdownPath.slice(1), root), output);
  if (htmlFile !== "404.html") fullSite.push(output);
}

await writeFile(new URL("llms-full.txt", root), fullSite.join("\n---\n\n"));
