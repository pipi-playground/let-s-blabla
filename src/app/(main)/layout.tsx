import TopNav from "@/components/TopNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <TopNav />
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
