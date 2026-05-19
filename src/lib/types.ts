export type HoldingType = "Stock" | "Call" | "Put";

export type Holding = {
  id: string;
  issuer: string;
  ticker?: string;
  title: string;
  cusip: string;
  value: number;
  shares: number;
  type: HoldingType;
  sector: string;
  weight: number;
  cusips?: string[];
  rows?: number;
};

export type FilingSnapshot = {
  label: string;
  period: string;
  filed: string;
  accession: string;
  source: string;
  total: number;
  coverTotal?: number;
  count: number;
  rawRows: number;
  holdings: Holding[];
};

export type MovementStatus = "New" | "Exited" | "Increased" | "Reduced" | "Unchanged";

export type MovementRow = {
  id: string;
  issuer: string;
  ticker?: string;
  type: HoldingType;
  sector: string;
  previous: number;
  latest: number;
  delta: number;
  status: MovementStatus;
};

export type FundDashboardPayload = {
  manager: string;
  cik: string;
  generatedAt: string;
  filings: FilingSnapshot[];
  movement: MovementRow[];
};

export type SearchResult = {
  name: string;
  cik: string;
  ticker?: string;
  has13F: boolean | null;
  latest13F?: string;
  reason?: string;
};

export type SecFilingSummary = {
  accession: string;
  form: string;
  filed: string;
  period: string;
  primaryDocument: string;
  acceptedAt?: string;
};
