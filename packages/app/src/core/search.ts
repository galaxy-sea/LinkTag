import type { BrowserTab, LinkRecord, TagRecord } from "../types";

export type ParsedSearchQuery = {
  keywords: string[];
  tagTerms: string[];
  linkTerms: string[];
};

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function splitSearchTerms(value: string) {
  return value
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const keywords: string[] = [];
  const tagTerms: string[] = [];
  const linkTerms: string[] = [];
  const tokens = query.trim().split(/\s+/).filter(Boolean);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const match = /^@(tag|link)(?::|=)?(.*)$/i.exec(token);
    if (!match) {
      keywords.push(token.toLowerCase());
      continue;
    }

    const nextToken = tokens[index + 1];
    const value = match[2] || (nextToken && !nextToken.startsWith("@") ? nextToken : "");
    if (!match[2] && value) index += 1;
    const terms = splitSearchTerms(value);
    if (match[1].toLowerCase() === "tag") tagTerms.push(...terms);
    else linkTerms.push(...terms);
  }

  return { keywords, tagTerms, linkTerms };
}

export function searchIsEmpty(search: ParsedSearchQuery) {
  return search.keywords.length === 0 && search.tagTerms.length === 0 && search.linkTerms.length === 0;
}

function matchesAnyTerm(values: Array<string | undefined>, terms: string[]) {
  if (!terms.length) return true;
  return terms.some((term) => values.some((value) => value?.toLowerCase().includes(term)));
}

export function matchesEveryKeyword(values: Array<string | undefined>, keywords: string[]) {
  return keywords.every((keyword) => values.some((value) => value?.toLowerCase().includes(keyword)));
}

export function searchMatchesTag(tag: TagRecord, search: ParsedSearchQuery) {
  return matchesAnyTerm([tag.name], search.tagTerms) && matchesEveryKeyword([tag.name], search.keywords);
}

export function searchMatchesLink(
  link: LinkRecord,
  search: ParsedSearchQuery,
  tagNames: string[] = [],
  extraValues: string[] = [],
) {
  const linkValues = [link.title, link.url, getDomain(link.url), ...extraValues];
  return (
    matchesAnyTerm(tagNames, search.tagTerms) &&
    matchesAnyTerm(linkValues, search.linkTerms) &&
    matchesEveryKeyword([...linkValues, ...tagNames], search.keywords)
  );
}

export function searchMatchesTab(tab: BrowserTab, search: ParsedSearchQuery, tagNames: string[] = []) {
  const linkValues = [tab.title, tab.url, getDomain(tab.url)];
  return (
    matchesAnyTerm(tagNames, search.tagTerms) &&
    matchesAnyTerm(linkValues, search.linkTerms) &&
    matchesEveryKeyword([...linkValues, ...tagNames], search.keywords)
  );
}
