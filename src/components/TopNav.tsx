"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearCache, fetchers, revalidate, useFriendRequests, useProfile } from "@/lib/client/cache";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/friends", label: "친구" },
  { href: "/history", label: "기록" },
  { href: "/settings", label: "설정" },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: requests } = useFriendRequests();
  const incomingCount = requests?.incoming.length ?? 0;

  // 앱으로 돌아왔을 때(백그라운드 → 포그라운드) 새 친구 요청 / 목록을 조용히 갱신
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      revalidate("friendRequests", fetchers.friendRequests, true).catch(() => {});
      revalidate("friends", fetchers.friends, true).catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearCache();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="font-bold">렛블블</p>
          {profile && (
            <p className="truncate text-xs text-neutral-500">
              {profile.nickname} · 코드 {profile.member_code}
            </p>
          )}
        </div>
        <nav className="flex shrink-0 items-center gap-0.5 text-sm font-medium">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-md px-2.5 py-1.5 transition ${
                pathname === item.href
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {item.label}
              {item.href === "/friends" && incomingCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {incomingCount}
                </span>
              )}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="ml-0.5 rounded-md px-2 py-1.5 text-neutral-400 hover:bg-neutral-100"
          >
            로그아웃
          </button>
        </nav>
      </div>
    </header>
  );
}
