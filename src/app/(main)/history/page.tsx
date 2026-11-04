import HistoryView from "@/components/HistoryView";

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { tab } = await searchParams;
  return <HistoryView initialTab={tab === "received" ? "received" : "sent"} />;
}
