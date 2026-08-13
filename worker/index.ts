const MARKDOWN_PATHS = new Map<string, string>([
  ["/", "/index.md"],
  ["/index.html", "/index.md"],
  ["/index.md", "/index.md"],
  ["/services.html", "/services.md"],
  ["/services.md", "/services.md"],
  ["/contact.html", "/contact.md"],
  ["/contact.md", "/contact.md"],
  ["/support.html", "/support.md"],
  ["/support.md", "/support.md"],
  ["/privacy-policy.html", "/privacy-policy.md"],
  ["/privacy-policy.md", "/privacy-policy.md"],
  ["/data-deletion.html", "/data-deletion.md"],
  ["/data-deletion.md", "/data-deletion.md"],
  ["/refund-policy.html", "/refund-policy.md"],
  ["/refund-policy.md", "/refund-policy.md"],
  ["/security.html", "/security.md"],
  ["/security.md", "/security.md"],
  ["/terms.html", "/terms.md"],
  ["/terms.md", "/terms.md"],
  ["/404.html", "/404.md"],
  ["/404.md", "/404.md"]
]);

type Representation = "html" | "markdown" | "other";

function quality(accept: string, mediaType: string): number {
  const [type, subtype] = mediaType.split("/");

  return accept.split(",").reduce((best, entry) => {
    const [range, ...parameters] = entry.trim().toLowerCase().split(";");
    const [rangeType, rangeSubtype] = range.split("/");
    if (!rangeType || !rangeSubtype) return best;
    if (rangeType !== "*" && rangeType !== type) return best;
    if (rangeSubtype !== "*" && rangeSubtype !== subtype) return best;

    const qParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const q = qParameter ? Number.parseFloat(qParameter.split("=")[1]) : 1;
    return Number.isFinite(q) ? Math.max(best, q) : best;
  }, 0);
}

function exactQuality(accept: string, mediaType: string): number {
  return accept.split(",").reduce((best, entry) => {
    const [range, ...parameters] = entry.trim().toLowerCase().split(";");
    if (range !== mediaType) return best;

    const qParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const q = qParameter ? Number.parseFloat(qParameter.split("=")[1]) : 1;
    return Number.isFinite(q) ? Math.max(best, q) : best;
  }, 0);
}

function wantsMarkdown(request: Request, markdownPath: string | undefined): boolean {
  if (!markdownPath) return false;
  if (new URL(request.url).pathname.endsWith(".md")) return true;

  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  const markdownQuality = Math.max(
    exactQuality(accept, "text/markdown"),
    exactQuality(accept, "text/x-markdown"),
    exactQuality(accept, "application/markdown")
  );
  const htmlQuality = quality(accept, "text/html");

  return markdownQuality > 0 && markdownQuality >= htmlQuality;
}

function appendVary(headers: Headers, value: string): void {
  const values = new Set(
    (headers.get("vary") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  values.add(value);
  headers.set("Vary", [...values].join(", "));
}

function markdownUrl(requestUrl: string, markdownPath: string): string {
  const url = new URL(requestUrl);
  url.pathname = markdownPath;
  url.search = "";
  return url.toString();
}

function originRequest(request: Request, originBase: string, path?: string): Request {
  const incomingUrl = new URL(request.url);
  const originUrl = new URL(originBase);
  originUrl.pathname = path ?? incomingUrl.pathname;
  originUrl.search = incomingUrl.search;

  return new Request(originUrl, request);
}

async function fetchMarkdown(request: Request, env: Env, markdownPath: string): Promise<Response> {
  const publicUrl = markdownUrl(request.url, markdownPath);
  const headers = new Headers(request.headers);
  headers.set("Accept", "text/markdown, text/plain;q=0.9, */*;q=0.1");

  const originResponse = await fetch(new Request(originRequest(request, env.ORIGIN_URL, markdownPath), {
    headers,
    redirect: "follow"
  }));
  const responseHeaders = new Headers(originResponse.headers);
  responseHeaders.set("Content-Type", "text/markdown; charset=utf-8");
  responseHeaders.set("Content-Location", markdownPath);
  responseHeaders.set("Link", `<${publicUrl}>; rel="canonical"; type="text/markdown"`);
  appendVary(responseHeaders, "Accept");

  return new Response(request.method === "HEAD" ? null : originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders
  });
}

async function fetchHtml(request: Request, env: Env, markdownPath: string | undefined): Promise<Response> {
  const originResponse = await fetch(originRequest(request, env.ORIGIN_URL));
  if (!markdownPath) return originResponse;

  const responseHeaders = new Headers(originResponse.headers);
  const alternateUrl = markdownUrl(request.url, markdownPath);
  responseHeaders.append("Link", `<${alternateUrl}>; rel="alternate"; type="text/markdown"`);
  appendVary(responseHeaders, "Accept");

  return new Response(request.method === "HEAD" ? null : originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders
  });
}

function logRequest(request: Request, response: Response, representation: Representation): void {
  const cf = request.cf;
  console.log(JSON.stringify({
    event: "http_request",
    method: request.method,
    path: new URL(request.url).pathname,
    status: response.status,
    representation,
    accept: request.headers.get("accept"),
    userAgent: request.headers.get("user-agent"),
    country: cf?.country ?? null
  }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const markdownPath = MARKDOWN_PATHS.get(url.pathname);

      if (request.method !== "GET" && request.method !== "HEAD") {
        const response = await fetch(originRequest(request, env.ORIGIN_URL));
        logRequest(request, response, "other");
        return response;
      }

      let response: Response;
      let representation: Representation;
      if (markdownPath && wantsMarkdown(request, markdownPath)) {
        response = await fetchMarkdown(request, env, markdownPath);
        representation = "markdown";
      } else {
        response = await fetchHtml(request, env, markdownPath);
        representation = markdownPath ? "html" : "other";
      }
      logRequest(request, response, representation);
      return response;
    } catch (error) {
      console.error(JSON.stringify({
        event: "origin_error",
        method: request.method,
        path: new URL(request.url).pathname,
        message: error instanceof Error ? error.message : String(error)
      }));
      return new Response(request.method === "HEAD" ? null : "The site origin is temporarily unavailable.\n", {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }
  }
} satisfies ExportedHandler<Env>;
