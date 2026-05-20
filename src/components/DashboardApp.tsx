"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { compactDate, money, pct, whole } from "@/lib/format";
import { sectorColors } from "@/lib/sectors";
import type { FilingSnapshot, FundDashboardPayload, Holding, MovementRow, SearchResult } from "@/lib/types";

type ApiSearchResponse = {
  results?: SearchResult[];
  error?: string;
};

type ApiFundResponse = {
  payload?: FundDashboardPayload;
  error?: string;
};

const typeOptions = ["All", "Stock", "Call", "Put"] as const;

function latest(payload: FundDashboardPayload) {
  return payload.filings[payload.filings.length - 1];
}

function previous(payload: FundDashboardPayload) {
  return payload.filings[payload.filings.length - 2];
}

function sumBy(rows: Holding[], key: "sector" | "type") {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row[key], (out.get(row[key]) || 0) + row.value);
  return [...out.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function changeLabel(row: MovementRow) {
  if (row.status === "New" || row.status === "Exited") return row.status;
  if (row.status === "Increased") return "Added";
  if (row.status === "Reduced") return "Trimmed";
  return "Flat";
}

function EmptyDashboard({ onExample }: { onExample: () => void }) {
  return (
    <section className="empty-state">
      <p className="eyebrow">Try a known filing manager</p>
      <h1>Load a sample fund.</h1>
      <p>
        Start with Situational Awareness LP, or search another manager above.
      </p>
      <button className="ghost-button" type="button" onClick={onExample}>
        Try Situational Awareness LP
      </button>
    </section>
  );
}

function Kpis({ payload }: { payload: FundDashboardPayload }) {
  const l = latest(payload);
  const p = previous(payload);
  const top = l.holdings[0];
  const delta = p ? l.total - p.total : 0;
  const newCount = payload.movement.filter(row => row.status === "New").length;
  const exitCount = payload.movement.filter(row => row.status === "Exited").length;

  return (
    <section className="kpis" aria-label="Portfolio summary">
      <article className="metric-card">
        <span>Latest 13F book</span>
        <strong>{money.format(l.total)}</strong>
        <small>{l.label}</small>
      </article>
      <article className="metric-card">
        <span>Quarter change</span>
        <strong className={delta >= 0 ? "positive" : "negative"}>{delta >= 0 ? "+" : ""}{money.format(delta)}</strong>
        <small>{p ? `vs ${p.label}` : "No prior filing"}</small>
      </article>
      <article className="metric-card">
        <span>Holdings count</span>
        <strong>{whole.format(l.count)}</strong>
        <small>{newCount} new · {exitCount} exited</small>
      </article>
      <article className="metric-card">
        <span>Top concentration</span>
        <strong>{top ? pct.format(top.weight) : "-"}</strong>
        <small>{top ? `${top.ticker || top.issuer} · ${money.format(top.value)}` : "No holdings"}</small>
      </article>
    </section>
  );
}

function Filters({
  selectedPeriod,
  setSelectedPeriod,
  type,
  setType,
  sector,
  setSector,
  query,
  setQuery,
  payload
}: {
  selectedPeriod: string;
  setSelectedPeriod: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  sector: string;
  setSector: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  payload: FundDashboardPayload;
}) {
  const sectors = useMemo(
    () => [...new Set(payload.filings.flatMap(filing => filing.holdings.map(holding => holding.sector)))].sort(),
    [payload]
  );

  return (
    <section className="filters" aria-label="Dashboard controls">
      <label>
        Filing
        <select value={selectedPeriod} onChange={event => setSelectedPeriod(event.target.value)}>
          {payload.filings.slice().reverse().map(filing => (
            <option key={filing.period} value={filing.period}>{filing.label} · {filing.period}</option>
          ))}
        </select>
      </label>
      <label>
        Position
        <select value={type} onChange={event => setType(event.target.value)}>
          {typeOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label>
        Sector
        <select value={sector} onChange={event => setSector(event.target.value)}>
          <option value="All">All</option>
          {sectors.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label>
        Search holdings
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Issuer or ticker" />
      </label>
    </section>
  );
}

function Treemap({ rows }: { rows: Holding[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="treemap" aria-label="Portfolio map">
      {rows.slice(0, 36).map(row => {
        const share = total ? row.value / total : 0;
        const span = Math.max(2, Math.min(12, Math.round(share * 36)));
        return (
          <div
            className="tile"
            key={row.id}
            style={{
              gridColumn: `span ${span}`,
              backgroundColor: sectorColors[row.sector] || sectorColors.Other
            }}
            title={`${row.issuer} · ${money.format(row.value)} · ${pct.format(row.weight)}`}
          >
            <strong>{row.ticker || row.issuer}</strong>
            <span>{money.format(row.value)} · {pct.format(row.weight)}</span>
            <span>{row.type}</span>
          </div>
        );
      })}
    </div>
  );
}

function Bars({ rows, metric }: { rows: Holding[]; metric: "sector" | "type" }) {
  const data = sumBy(rows, metric);
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="bars">
      {data.map(row => {
        const color = metric === "sector"
          ? sectorColors[row.name] || sectorColors.Other
          : row.name === "Put"
            ? "var(--red)"
            : row.name === "Call"
              ? "var(--blue)"
              : "var(--green)";
        return (
          <div className="bar-row" key={row.name}>
            <strong>{row.name}</strong>
            <div className="track"><span style={{ width: `${total ? (row.value / total) * 100 : 0}%`, backgroundColor: color }} /></div>
            <em>{pct.format(total ? row.value / total : 0)}</em>
          </div>
        );
      })}
    </div>
  );
}

function Trend({ filings }: { filings: FilingSnapshot[] }) {
  const width = 720;
  const height = 250;
  const pad = { left: 44, right: 18, top: 18, bottom: 38 };
  const max = Math.max(...filings.map(filing => filing.total), 1);
  const x = (index: number) => pad.left + index * ((width - pad.left - pad.right) / Math.max(filings.length - 1, 1));
  const y = (value: number) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const line = filings.map((filing, index) => `${index ? "L" : "M"}${x(index)},${y(filing.total)}`).join(" ");
  const area = `${line} L${x(filings.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z`;

  return (
    <svg className="trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="13F value trend">
      <path d={area} fill="rgba(91, 215, 199, .16)" />
      <path d={line} fill="none" stroke="var(--yellow)" strokeWidth="3" strokeLinecap="round" />
      <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="var(--line)" />
      {filings.map((filing, index) => (
        <g key={filing.accession}>
          <circle cx={x(index)} cy={y(filing.total)} r="4" fill="var(--panel)" stroke="var(--yellow)" strokeWidth="2" />
          <text x={x(index)} y={height - 12} textAnchor="middle">{filing.label.replace("20", "'")}</text>
        </g>
      ))}
    </svg>
  );
}

function MovementChart({ rows }: { rows: MovementRow[] }) {
  const selected = rows.slice(0, 16);
  const max = Math.max(...selected.map(row => Math.abs(row.delta)), 1);
  return (
    <div className="movement-chart">
      {selected.map(row => {
        const width = Math.abs(row.delta) / max * 50;
        const left = row.delta >= 0 ? 50 : 50 - width;
        return (
          <div className="move-row" key={row.id}>
            <strong>{row.ticker || row.issuer}<span>{changeLabel(row)}</span></strong>
            <div className="move-track">
              <i />
              <b
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: row.delta >= 0 ? "var(--green)" : "var(--red)"
                }}
              />
            </div>
            <em className={row.delta >= 0 ? "positive" : "negative"}>{row.delta >= 0 ? "+" : ""}{money.format(row.delta)}</em>
          </div>
        );
      })}
    </div>
  );
}

function HoldingsTable({ rows }: { rows: Holding[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Issuer</th>
            <th>Ticker</th>
            <th>Type</th>
            <th>Sector</th>
            <th className="num">Value</th>
            <th className="num">Weight</th>
            <th className="num">Shares / Principal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td><strong>{row.issuer}</strong></td>
              <td>{row.ticker || "-"}</td>
              <td>{row.type}</td>
              <td>{row.sector}</td>
              <td className="num">{money.format(row.value)}</td>
              <td className="num">{pct.format(row.weight)}</td>
              <td className="num">{whole.format(row.shares)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovesTable({ rows }: { rows: MovementRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Action</th>
            <th className="num">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 18).map(row => (
            <tr key={row.id}>
              <td><strong>{row.ticker || row.issuer}</strong><br /><small>{row.type}</small></td>
              <td>{changeLabel(row)}</td>
              <td className={`num ${row.delta >= 0 ? "positive" : "negative"}`}>{row.delta >= 0 ? "+" : ""}{money.format(row.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard({ payload }: { payload: FundDashboardPayload }) {
  const l = latest(payload);
  const [selectedPeriod, setSelectedPeriod] = useState(l.period);
  const [type, setType] = useState("All");
  const [sector, setSector] = useState("All");
  const [query, setQuery] = useState("");

  const selected = payload.filings.find(filing => filing.period === selectedPeriod) || l;
  const filtered = selected.holdings.filter(row => {
    const q = query.trim().toLowerCase();
    const typeOk = type === "All" || row.type === type;
    const sectorOk = sector === "All" || row.sector === sector;
    const queryOk = !q || row.issuer.toLowerCase().includes(q) || (row.ticker || "").toLowerCase().includes(q);
    return typeOk && sectorOk && queryOk;
  });

  const totals = payload.movement.reduce(
    (acc, row) => {
      if (row.delta > 0) acc.added += row.delta;
      if (row.delta < 0) acc.reduced += Math.abs(row.delta);
      return acc;
    },
    { added: 0, reduced: 0 }
  );

  return (
    <>
      <section className="fund-hero">
        <a className="back-link" href={l.source} target="_blank" rel="noreferrer">Latest SEC filing</a>
        <p className="eyebrow">SEC 13F-HR · CIK {payload.cik}</p>
        <h1>{payload.manager}</h1>
        <p>{payload.manager}. Latest period {l.period}, filed {compactDate(l.filed)}. Built {new Date(payload.generatedAt).toLocaleString()}.</p>
      </section>

      <Kpis payload={payload} />
      <Filters
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        type={type}
        setType={setType}
        sector={sector}
        setSector={setSector}
        query={query}
        setQuery={setQuery}
        payload={payload}
      />

      <section className="dashboard-grid">
        <article className="panel wide">
          <div className="panel-head">
            <div>
              <h2>Portfolio Map</h2>
              <p>Tile size follows reported market value; color follows best-effort sector.</p>
            </div>
            <span>{money.format(filtered.reduce((sum, row) => sum + row.value, 0))} selected</span>
          </div>
          <Treemap rows={filtered} />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Exposure Mix</h2>
              <p>Sector and instrument split for the selected filing.</p>
            </div>
          </div>
          <Bars rows={filtered} metric="sector" />
          <Bars rows={filtered} metric="type" />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Filing Trend</h2>
              <p>Total reported 13F value over time.</p>
            </div>
          </div>
          <Trend filings={payload.filings} />
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Movement Since Prior 13F</h2>
              <p>Latest quarter versus immediately prior 13F.</p>
            </div>
            <span>Adds {money.format(totals.added)} · cuts {money.format(totals.reduced)}</span>
          </div>
          <MovementChart rows={payload.movement} />
        </article>

        <article className="panel table-panel wide">
          <div className="panel-head">
            <div>
              <h2>Holdings</h2>
              <p>Current filtered positions, sorted by reported value.</p>
            </div>
          </div>
          <HoldingsTable rows={filtered} />
        </article>

        <article className="panel table-panel">
          <div className="panel-head">
            <div>
              <h2>Largest Moves</h2>
              <p>Largest absolute value changes in the latest quarter.</p>
            </div>
          </div>
          <MovesTable rows={payload.movement} />
        </article>
      </section>
    </>
  );
}

export function DashboardApp({ initialCik }: { initialCik?: string }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [payload, setPayload] = useState<FundDashboardPayload | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "loading">("idle");
  const [error, setError] = useState("");

  async function runSearch(value = search) {
    const q = value.trim();
    if (q.length < 2) return;
    setStatus("searching");
    setError("");
    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = (await response.json()) as ApiSearchResponse;
    if (!response.ok) {
      setError(data.error || "Search failed.");
      setResults([]);
    } else {
      setResults(data.results || []);
    }
    setStatus("idle");
  }

  async function loadFund(cik: string) {
    setStatus("loading");
    setError("");
    setResults([]);
    const response = await fetch(`/api/fund/${encodeURIComponent(cik)}`);
    const data = (await response.json()) as ApiFundResponse;
    if (!response.ok || !data.payload) {
      setError(data.error || "Fund load failed.");
    } else {
      setPayload(data.payload);
    }
    setStatus("idle");
  }

  useEffect(() => {
    if (!initialCik) return;
    setSearch(initialCik);
    void loadFund(initialCik);
    // Run once for direct fund URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCik]);

  function tryExample() {
    setSearch("0002045724");
    void runSearch("0002045724");
  }

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          <strong>13F</strong>
        </Link>
        <nav aria-label="Primary">
          <a href="#search">Search</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#sources">Sources</a>
        </nav>
      </header>

      <div className="shell">
        <section id="search" className="search-panel">
          <div>
            <p className="eyebrow">SEC 13F Analyzer</p>
            <h1>Find a Fund</h1>
          </div>
          <form
            className="fund-search"
            onSubmit={event => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <span>⌕</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by CIK, ticker, or company name"
              aria-label="Search SEC filers"
            />
            <button type="submit" disabled={status === "searching"}>{status === "searching" ? "Searching" : "Search"}</button>
          </form>
          {results.length > 0 && (
            <div className="results" role="list">
              {results.map(result => (
                <button
                  key={`${result.cik}-${result.ticker || "cik"}`}
                  type="button"
                  onClick={() => void loadFund(result.cik)}
                  disabled={result.has13F === false}
                  role="listitem"
                >
                  <strong>{result.name}</strong>
                  <span>{result.ticker ? `${result.ticker} · ` : ""}CIK {result.cik}</span>
                  <em className={result.has13F ? "positive" : result.has13F === false ? "negative" : ""}>
                    {result.has13F ? `13F available${result.latest13F ? ` · ${result.latest13F}` : ""}` : result.has13F === false ? "No 13F found" : "Checking"}
                  </em>
                </button>
              ))}
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        <div id="dashboard">
          {status === "loading" && <section className="loading-state">Loading filer...</section>}
          {!payload && status !== "loading" && error && <EmptyDashboard onExample={tryExample} />}
          {payload && status !== "loading" && <Dashboard key={payload.cik} payload={payload} />}
        </div>

        <footer id="sources">
          Data source: SEC EDGAR 13F-HR information tables. 13F disclosures are delayed snapshots and omit shorts, cash, many derivatives, and non-reportable holdings. Sector and ticker enrichment is best effort and non-authoritative.
        </footer>
      </div>
    </main>
  );
}
