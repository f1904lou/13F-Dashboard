import { quarterLabel } from "@/lib/format";
import { sectorFor, tickerByCusip } from "@/lib/sectors";
import type {
  FilingSnapshot,
  FundDashboardPayload,
  Holding,
  HoldingType,
  MovementRow,
  SearchResult,
  SecFilingSummary
} from "@/lib/types";

const SEC_ROOT = "https://www.sec.gov";
const DATA_ROOT = "https://data.sec.gov";
const COMPANY_TICKERS_URL = `${SEC_ROOT}/files/company_tickers.json`;
const CIK_LOOKUP_URL = `${SEC_ROOT}/Archives/edgar/cik-lookup-data.txt`;
const MAX_SEC_RPS_DELAY = 140;

type SecCompany = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SecFiler = {
  name: string;
  cik: string;
};

type RawInfoRow = {
  issuer: string;
  title: string;
  cusip: string;
  value: number;
  shares: number;
  type: HoldingType;
};

type SecSubmission = {
  name?: string;
  cik?: string;
  filings?: {
    recent?: Record<string, string[]>;
    files?: Array<{ name: string }>;
  };
};

let lastSecRequest = 0;

export function normalizeCik(input: string | number) {
  const digits = String(input).replace(/\D/g, "");
  if (!digits) throw new Error("CIK must contain digits.");
  return digits.padStart(10, "0").slice(-10);
}

export function cikForArchive(input: string | number) {
  return String(Number(normalizeCik(input)));
}

export function accessionNoDashes(accession: string) {
  return accession.replace(/-/g, "");
}

function secUserAgent() {
  const value = process.env.SEC_USER_AGENT;
  if (!value) {
    throw new Error("SEC_USER_AGENT is required for SEC API requests.");
  }
  return value;
}

async function waitForSecSlot() {
  const now = Date.now();
  const wait = Math.max(0, lastSecRequest + MAX_SEC_RPS_DELAY - now);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastSecRequest = Date.now();
}

export async function secFetch(url: string, init?: RequestInit) {
  await waitForSecSlot();
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": secUserAgent(),
      Accept: "application/json, text/xml, application/xml, text/plain, */*",
      ...(init?.headers || {})
    },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`SEC request failed ${response.status} for ${url}`);
  }

  return response;
}

export async function fetchSubmissions(cik: string): Promise<SecSubmission> {
  const normalized = normalizeCik(cik);
  const response = await secFetch(`${DATA_ROOT}/submissions/CIK${normalized}.json`);
  return response.json() as Promise<SecSubmission>;
}

function recentFilingsFromSubmission(submission: SecSubmission): SecFilingSummary[] {
  const recent = submission.filings?.recent;
  if (!recent) return [];

  const accessions = recent.accessionNumber || [];
  return accessions.map((accession, index) => ({
    accession,
    form: recent.form?.[index] || "",
    filed: recent.filingDate?.[index] || "",
    period: recent.reportDate?.[index] || "",
    primaryDocument: recent.primaryDocument?.[index] || "",
    acceptedAt: recent.acceptanceDateTime?.[index]
  }));
}

function is13F(form: string) {
  return form === "13F-HR" || form === "13F-HR/A";
}

function periodRank(filing: SecFilingSummary) {
  return `${filing.period || "0000-00-00"} ${filing.filed || "0000-00-00"} ${filing.acceptedAt || ""}`;
}

export function selectLatest13FFilings(submission: SecSubmission, limit = 8) {
  const byPeriod = new Map<string, SecFilingSummary>();

  for (const filing of recentFilingsFromSubmission(submission).filter(f => is13F(f.form) && f.period)) {
    const existing = byPeriod.get(filing.period);
    if (!existing || periodRank(filing) > periodRank(existing)) {
      byPeriod.set(filing.period, filing);
    }
  }

  return [...byPeriod.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-limit);
}

function archiveBase(cik: string, accession: string) {
  return `${SEC_ROOT}/Archives/edgar/data/${cikForArchive(cik)}/${accessionNoDashes(accession)}`;
}

export function filingTextUrl(cik: string, accession: string) {
  return `${archiveBase(cik, accession)}/${accession}.txt`;
}

function tagValue(block: string, tag: string) {
  const pattern = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, "i");
  const match = block.match(pattern);
  if (!match) return "";
  return decodeXml(match[1].replace(/<[^>]*>/g, "").trim());
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function numberValue(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function holdingType(block: string): HoldingType {
  const putCall = tagValue(block, "putCall").toUpperCase();
  if (putCall === "CALL") return "Call";
  if (putCall === "PUT") return "Put";
  return "Stock";
}

export function parseInformationTable(xmlOrText: string): RawInfoRow[] {
  const rows = [...xmlOrText.matchAll(/<(?:[a-zA-Z0-9_-]+:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?infoTable>/gi)];

  return rows
    .map(match => {
      const block = match[1];
      return {
        issuer: tagValue(block, "nameOfIssuer").toUpperCase(),
        title: tagValue(block, "titleOfClass"),
        cusip: tagValue(block, "cusip").toUpperCase(),
        value: numberValue(tagValue(block, "value")),
        shares: numberValue(tagValue(block, "sshPrnamt")),
        type: holdingType(block)
      };
    })
    .filter(row => row.issuer && row.cusip);
}

function normalizeIssuer(value: string) {
  return value
    .toUpperCase()
    .replace(/\b(CORP\.?|INC\.?|LTD\.?|PLC|CO\.?|COM|NEW|CLASS|CL|A)\b/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTickerLookup(companies: SecCompany[]) {
  const lookup = new Map<string, string>();
  for (const company of companies) {
    lookup.set(normalizeIssuer(company.title), company.ticker.toUpperCase());
  }
  return lookup;
}

function tickerForIssuer(issuer: string, lookup: Map<string, string>) {
  const normalized = normalizeIssuer(issuer);
  if (lookup.has(normalized)) return lookup.get(normalized);
  return undefined;
}

export function normalizeHoldings(rows: RawInfoRow[], tickerLookup = new Map<string, string>()): Holding[] {
  const grouped = new Map<string, Holding>();

  for (const row of rows) {
    const ticker = tickerByCusip[row.cusip] || tickerForIssuer(row.issuer, tickerLookup);
    const id = `${row.issuer}|${row.cusip}|${row.type}`;
    const existing = grouped.get(id);
    if (existing) {
      existing.value += row.value;
      existing.shares += row.shares;
      existing.rows = (existing.rows || 1) + 1;
      continue;
    }

    grouped.set(id, {
      id,
      issuer: row.issuer,
      ticker,
      title: row.title,
      cusip: row.cusip,
      value: row.value,
      shares: row.shares,
      type: row.type,
      sector: sectorFor(ticker, row.issuer),
      weight: 0,
      cusips: [row.cusip],
      rows: 1
    });
  }

  const holdings = [...grouped.values()].sort((a, b) => b.value - a.value);
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
  return holdings.map(holding => ({
    ...holding,
    weight: total ? holding.value / total : 0
  }));
}

export function buildMovement(filings: FilingSnapshot[]): MovementRow[] {
  if (filings.length < 2) return [];
  const previous = filings[filings.length - 2];
  const latest = filings[filings.length - 1];
  const ids = new Set([...previous.holdings.map(h => h.id), ...latest.holdings.map(h => h.id)]);
  const previousMap = new Map(previous.holdings.map(h => [h.id, h]));
  const latestMap = new Map(latest.holdings.map(h => [h.id, h]));

  return [...ids]
    .map(id => {
      const prev = previousMap.get(id);
      const next = latestMap.get(id);
      const previousValue = prev?.value || 0;
      const latestValue = next?.value || 0;
      const delta = latestValue - previousValue;
      const row = next || prev;
      const status =
        previousValue === 0 && latestValue > 0
          ? "New"
          : latestValue === 0 && previousValue > 0
            ? "Exited"
            : delta > 0
              ? "Increased"
              : delta < 0
                ? "Reduced"
                : "Unchanged";

      return {
        id,
        issuer: row?.issuer || id,
        ticker: row?.ticker,
        type: row?.type || "Stock",
        sector: row?.sector || "Other",
        previous: previousValue,
        latest: latestValue,
        delta,
        status
      } satisfies MovementRow;
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function snapshotFromRows(
  cik: string,
  filing: SecFilingSummary,
  rows: RawInfoRow[],
  tickerLookup?: Map<string, string>
): FilingSnapshot {
  const holdings = normalizeHoldings(rows, tickerLookup);
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);

  return {
    label: quarterLabel(filing.period),
    period: filing.period,
    filed: filing.filed,
    accession: filing.accession,
    source: filingTextUrl(cik, filing.accession),
    total,
    coverTotal: total,
    count: holdings.length,
    rawRows: rows.length,
    holdings
  };
}

async function fetchArchiveIndex(cik: string, accession: string) {
  const response = await secFetch(`${archiveBase(cik, accession)}/index.json`);
  return response.json() as Promise<{ directory?: { item?: Array<{ name: string; type?: string }> } }>;
}

function chooseInfoTableDocument(names: string[]) {
  const xml = names.filter(name => /\.xml$/i.test(name));
  return (
    xml.find(name => /info|table/i.test(name) && !/primary/i.test(name)) ||
    xml.find(name => !/primary|xsl|schema/i.test(name)) ||
    xml[0]
  );
}

export async function fetchFilingRows(cik: string, filing: SecFilingSummary) {
  try {
    const index = await fetchArchiveIndex(cik, filing.accession);
    const names = index.directory?.item?.map(item => item.name) || [];
    const infoTable = chooseInfoTableDocument(names);
    if (infoTable) {
      const response = await secFetch(`${archiveBase(cik, filing.accession)}/${infoTable}`);
      const text = await response.text();
      const rows = parseInformationTable(text);
      if (rows.length) return rows;
    }
  } catch {
    // Fall through to full filing text parsing.
  }

  const fallback = await secFetch(filingTextUrl(cik, filing.accession));
  return parseInformationTable(await fallback.text());
}

export async function fetchCompanyTickers() {
  const response = await secFetch(COMPANY_TICKERS_URL);
  const data = (await response.json()) as Record<string, SecCompany>;
  return Object.values(data);
}

export async function fetchCikLookup() {
  const response = await secFetch(CIK_LOOKUP_URL, {
    headers: { Accept: "text/plain, */*" }
  });
  const text = await response.text();
  const filers: SecFiler[] = [];

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(.*):(\d{1,10}):$/);
    const name = match?.[1]?.trim();
    const cik = match?.[2];
    if (!name || !cik) continue;
    filers.push({ name, cik: normalizeCik(cik) });
  }

  return filers;
}

export async function buildFundDashboard(cik: string, companies: SecCompany[] = []) {
  const normalized = normalizeCik(cik);
  const submission = await fetchSubmissions(normalized);
  const filings = selectLatest13FFilings(submission);
  if (!filings.length) {
    throw new Error("No 13F-HR filings found for this CIK.");
  }

  const tickerLookup = buildTickerLookup(companies);
  const snapshots: FilingSnapshot[] = [];
  for (const filing of filings) {
    const rows = await fetchFilingRows(normalized, filing);
    snapshots.push(snapshotFromRows(normalized, filing, rows, tickerLookup));
  }

  return {
    manager: submission.name || `CIK ${normalized}`,
    cik: normalized,
    generatedAt: new Date().toISOString(),
    filings: snapshots,
    movement: buildMovement(snapshots)
  } satisfies FundDashboardPayload;
}

export async function searchCompanies(query: string, companies: SecCompany[]) {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const exactCik = /^\d+$/.test(q) ? normalizeCik(q) : "";
  const scored = companies
    .map(company => {
      const cik = normalizeCik(company.cik_str);
      const ticker = company.ticker.toUpperCase();
      const title = company.title.toUpperCase();
      let score = 0;
      if (exactCik && cik === exactCik) score += 100;
      if (ticker === q) score += 90;
      if (title === q) score += 80;
      if (ticker.startsWith(q)) score += 50;
      if (title.includes(q)) score += 30;
      return { company, cik, ticker, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const results: SearchResult[] = scored.map(({ company, cik, ticker }) => ({
    name: company.title,
    cik,
    ticker,
    has13F: null
  }));

  if (exactCik && !results.some(result => result.cik === exactCik)) {
    results.unshift({
      name: `CIK ${exactCik}`,
      cik: exactCik,
      has13F: null
    });
  }

  return results.slice(0, 8);
}

function normalizedSearchText(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchCikLookup(query: string, filers: SecFiler[]) {
  const q = normalizedSearchText(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);

  return filers
    .map(filer => {
      const name = normalizedSearchText(filer.name);
      let score = 0;
      if (name === q) score += 80;
      if (name.startsWith(q)) score += 60;
      if (name.includes(q)) score += 35;
      if (tokens.length > 1 && tokens.every(token => name.includes(token))) score += 25;
      if (score > 0 && /\b(MANAGEMENT|ADVISORS?|CAPITAL|PARTNERS?)\b/.test(name)) score += 18;
      return { filer, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.filer.name.localeCompare(b.filer.name))
    .slice(0, 10)
    .map(({ filer }) => ({
      name: filer.name,
      cik: filer.cik,
      has13F: null
    } satisfies SearchResult));
}

export function mergeSearchResults(results: SearchResult[], limit = 8) {
  const byCik = new Map<string, SearchResult>();
  for (const result of results) {
    const existing = byCik.get(result.cik);
    if (!existing) {
      byCik.set(result.cik, result);
      continue;
    }

    byCik.set(result.cik, {
      ...existing,
      ...result,
      ticker: existing.ticker || result.ticker,
      name: existing.ticker ? existing.name : result.name
    });
  }

  return [...byCik.values()].slice(0, limit);
}

export async function with13FAvailability(results: SearchResult[]) {
  const checked = await Promise.all(
    results.map(async result => {
      try {
        const submission = await fetchSubmissions(result.cik);
        const filings = selectLatest13FFilings(submission, 1);
        return {
          ...result,
          name: submission.name || result.name,
          has13F: filings.length > 0,
          latest13F: filings.at(-1)?.period
        } satisfies SearchResult;
      } catch (error) {
        return {
          ...result,
          has13F: false,
          reason: error instanceof Error ? error.message : "Unable to check filings."
        } satisfies SearchResult;
      }
    })
  );

  return checked.sort((a, b) => {
    if (a.has13F !== b.has13F) return a.has13F ? -1 : b.has13F ? 1 : 0;
    return a.name.localeCompare(b.name);
  });
}
