import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import {
  fetchCompanyTickers,
  fetchSubmissions,
  normalizeCik,
  searchCompanies,
  selectLatest13FFilings,
  with13FAvailability
} from "@/lib/sec";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });

  try {
    if (/^\D*\d[\d\s-]*$/.test(q.trim())) {
      const cik = normalizeCik(q);
      const submission = await fetchSubmissions(cik);
      const filings = selectLatest13FFilings(submission, 1);
      return NextResponse.json({
        results: [{
          name: submission.name || `CIK ${cik}`,
          cik,
          has13F: filings.length > 0,
          latest13F: filings.at(-1)?.period
        }]
      });
    }

    const cachedCompanies = await getCached<Awaited<ReturnType<typeof fetchCompanyTickers>>>("sec:company-tickers");
    const companies = cachedCompanies || (await fetchCompanyTickers());
    if (!cachedCompanies) await setCached("sec:company-tickers", companies, 60 * 60 * 24);

    const candidates = await searchCompanies(q, companies);
    const results = await with13FAvailability(candidates);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}
