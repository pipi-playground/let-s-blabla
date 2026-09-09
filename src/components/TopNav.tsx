"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/friends", label: "친구" },
  { href: "/settings", label: "설정" },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ nickname: string; member_code: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("nickname, member_code")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div>
          <p className="font-bold">렛블블</p>
          {profile && (
            <p className="text-xs text-neutral-500">
              {profile.nickname} · 코드 {profile.member_code}
            </p>
          )}
        </div>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 transition ${
                pathname === item.href
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="ml-1 rounded-md px-3 py-1.5 text-neutral-400 hover:bg-neutral-100"
          >
            로그아웃
          </button>
        </nav>
      </div>
    </header>
  );
}
