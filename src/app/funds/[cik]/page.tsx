import { DashboardApp } from "@/components/DashboardApp";

type FundPageProps = {
  params: Promise<{ cik: string }>;
};

export default async function FundPage({ params }: FundPageProps) {
  const { cik } = await params;
  return <DashboardApp initialCik={cik} />;
}
