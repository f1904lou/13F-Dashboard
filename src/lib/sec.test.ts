import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accessionNoDashes,
  buildMovement,
  mergeSearchResults,
  normalizeCik,
  parseInformationTable,
  searchCikLookup,
  selectLatest13FFilings,
  snapshotFromRows
} from "@/lib/sec";
import type { SecFilingSummary } from "@/lib/types";

describe("SEC 13F utilities", () => {
  it("normalizes CIK and accession identifiers", () => {
    expect(normalizeCik("2045724")).toBe("0002045724");
    expect(normalizeCik("CIK 0002045724")).toBe("0002045724");
    expect(accessionNoDashes("0002045724-26-000008")).toBe("000204572426000008");
  });

  it("parses Situational Awareness Q1 2026 fixture with expected total and count", () => {
    const fixture = readFileSync(
      join(process.cwd(), "src/test-fixtures/situational-awareness-q1-2026.txt"),
      "utf8"
    );
    const rows = parseInformationTable(fixture);
    const filing: SecFilingSummary = {
      accession: "0002045724-26-000008",
      form: "13F-HR",
      filed: "2026-05-18",
      period: "2026-03-31",
      primaryDocument: "primary_doc.xml"
    };
    const snapshot = snapshotFromRows("0002045724", filing, rows);

    expect(snapshot.total).toBe(13676657577);
    expect(snapshot.count).toBe(42);
    expect(snapshot.holdings[0].type).toBe("Put");
    expect(snapshot.holdings.some(holding => holding.type === "Call")).toBe(true);
    expect(snapshot.holdings.some(holding => holding.type === "Stock")).toBe(true);
  });

  it("handles XML namespace variations", () => {
    const rows = parseInformationTable(`
      <ns:informationTable xmlns:ns="x">
        <ns:infoTable>
          <ns:nameOfIssuer>Example Inc</ns:nameOfIssuer>
          <ns:titleOfClass>COM</ns:titleOfClass>
          <ns:cusip>123456789</ns:cusip>
          <ns:value>7</ns:value>
          <ns:shrsOrPrnAmt><ns:sshPrnamt>22</ns:sshPrnamt></ns:shrsOrPrnAmt>
          <ns:putCall>CALL</ns:putCall>
        </ns:infoTable>
      </ns:informationTable>
    `);

    expect(rows).toEqual([
      {
        issuer: "EXAMPLE INC",
        title: "COM",
        cusip: "123456789",
        value: 7,
        shares: 22,
        type: "Call"
      }
    ]);
  });

  it("deduplicates amended 13F filings by period", () => {
    const submission = {
      filings: {
        recent: {
          accessionNumber: ["a", "b", "c"],
          form: ["13F-HR", "13F-HR/A", "10-K"],
          filingDate: ["2026-01-01", "2026-01-03", "2026-01-04"],
          reportDate: ["2025-12-31", "2025-12-31", "2025-12-31"],
          primaryDocument: ["a.xml", "b.xml", "c.htm"],
          acceptanceDateTime: ["2026-01-01T00:00:00", "2026-01-03T00:00:00", "2026-01-04T00:00:00"]
        }
      }
    };

    expect(selectLatest13FFilings(submission).map(filing => filing.accession)).toEqual(["b"]);
  });

  it("computes movement statuses", () => {
    const movement = buildMovement([
      {
        label: "2025 Q4",
        period: "2025-12-31",
        filed: "2026-02-01",
        accession: "old",
        source: "#",
        total: 300,
        count: 2,
        rawRows: 2,
        holdings: [
          { id: "A", issuer: "A", title: "COM", cusip: "1", value: 100, shares: 1, type: "Stock", sector: "Other", weight: 1 / 3 },
          { id: "B", issuer: "B", title: "COM", cusip: "2", value: 200, shares: 1, type: "Stock", sector: "Other", weight: 2 / 3 }
        ]
      },
      {
        label: "2026 Q1",
        period: "2026-03-31",
        filed: "2026-05-01",
        accession: "new",
        source: "#",
        total: 500,
        count: 2,
        rawRows: 2,
        holdings: [
          { id: "A", issuer: "A", title: "COM", cusip: "1", value: 150, shares: 1, type: "Stock", sector: "Other", weight: .3 },
          { id: "C", issuer: "C", title: "COM", cusip: "3", value: 350, shares: 1, type: "Stock", sector: "Other", weight: .7 }
        ]
      }
    ]);

    expect(movement.find(row => row.id === "A")?.status).toBe("Increased");
    expect(movement.find(row => row.id === "B")?.status).toBe("Exited");
    expect(movement.find(row => row.id === "C")?.status).toBe("New");
  });

  it("searches broad CIK lookup names and merges duplicate results", async () => {
    const lookupResults = await searchCikLookup("situational awareness", [
      { name: "Situational Awareness LP", cik: "0002045724" },
      { name: "Unrelated Manager LLC", cik: "0000000001" }
    ]);

    expect(lookupResults).toEqual([
      {
        name: "Situational Awareness LP",
        cik: "0002045724",
        has13F: null
      }
    ]);

    expect(mergeSearchResults([
      { name: "NVIDIA CORP", cik: "0001045810", ticker: "NVDA", has13F: null },
      { name: "NVIDIA CORP", cik: "0001045810", has13F: null }
    ])).toEqual([
      { name: "NVIDIA CORP", cik: "0001045810", ticker: "NVDA", has13F: null }
    ]);
  });
});
