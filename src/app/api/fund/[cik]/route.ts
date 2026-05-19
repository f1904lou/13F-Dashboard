import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { buildFundDashboard, fetchCompanyTickers, fetchSubmissions, normalizeCik, selectLatest13FFilings } from "@/lib/sec";
import type { FundDashboardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ cik: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { cik } = await context.params;

  try {
    const normalized = normalizeCik(cik);
    const submission = await fetchSubmissions(normalized);
    const latest = selectLatest13FFilings(submission, 1).at(-1);
    if (!latest) {
      return NextResponse.json(
        { error: "No 13F-HR filings found for this CIK.", manager: submission.name || `CIK ${normalized}`, cik: normalized },
        { status: 404 }
      );
    }

    const cacheKey = `fund:${normalized}:${latest.accession}`;
    const cached = await getCached<FundDashboardPayload>(cacheKey);
    if (cached) return NextResponse.json({ payload: cached, cache: "hit" });

    const cachedCompanies = await getCached<Awaited<ReturnType<typeof fetchCompanyTickers>>>("sec:company-tickers");
    const companies = cachedCompanies || (await fetchCompanyTickers());
    if (!cachedCompanies) await setCached("sec:company-tickers", companies, 60 * 60 * 24);

    const payload = await buildFundDashboard(normalized, companies);
    await setCached(cacheKey, payload, 60 * 60 * 24 * 7);
    return NextResponse.json({ payload, cache: "miss" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fund load failed." },
      { status: 500 }
    );
  }
}
