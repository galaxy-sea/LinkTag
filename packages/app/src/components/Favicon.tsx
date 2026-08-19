import { useEffect, useMemo, useState } from "react";

function faviconFallbackUrls(url: string, src?: string) {
  const urls: string[] = [];
  const pushUrl = (value: string | undefined) => {
    if (value && !urls.includes(value)) urls.push(value);
  };
  pushUrl(src);
  try {
    const domain = new URL(url).hostname;
    if (domain) {
      pushUrl(`https://a.favicon.im/${domain}?throw-error-on-404=true`);
      pushUrl(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`);
    }
  } catch {
    // Invalid URLs fall back to the text marker.
  }
  return urls;
}

export function Favicon({ src, url, title }: { src?: string; url: string; title: string }) {
  const candidates = useMemo(() => faviconFallbackUrls(url, src), [src, url]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [candidates]);
  const currentSrc = candidates[index];
  return currentSrc ? (
    <img
      className="h-5 w-5 shrink-0 rounded-sm"
      src={currentSrc}
      alt=""
      draggable={false}
      onError={() => setIndex((current) => current + 1)}
    />
  ) : (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold">
      {title.slice(0, 1)}
    </span>
  );
}
