"use client";

import { useState } from "react";
import { useCached } from "@/lib/client/cache";
import type { HistoryItem, SendStatus } from "@/types/app";

type Tab = "sent" | "received";
type Order = "desc" | "asc";

interface Page {
  items: HistoryItem[];
  hasMore: boolean;
}

const SENT_STATUS: Record<SendStatus, string> = {
  sent: "✅ 전송됨",
  muted: "🔕 상대가 알림 꺼둠",
  dnd: "🌙 상대 방해금지 시간",
  failed: "⚠️ 전송 실패",
  no_subscription: "📵 상대 알림 미설정",
};

const RECEIVED_STATUS: Partial<Record<SendStatus, string>> = {
  muted: "🔕 알림 꺼둠으로 안 울림",
  dnd: "🌙 방해금지로 안 울림",
  failed: "⚠️ 전달 실패",
  no_subscription: "📵 알림 미설정으로 안 울림",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchPage(tab: Tab, order: Order, offset: number): Promise<Page> {
  const res = await fetch(`/api/history?type=${tab}&order=${order}&offset=${offset}`);
  if (!res.ok) throw new Error("기록을 불러오지 못했어요.");
  return res.json();
}

export default function HistoryView({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [order, setOrder] = useState<Order>("desc");
  const [loadingMore, setLoadingMore] = useState(false);

  const key = `history:${tab}:${order}`;
  const { data, mutate } = useCached<Page>(key, () => fetchPage(tab, order, 0));

  async function loadMore() {
    if (!data) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(tab, order, data.items.length);
      mutate((prev) => ({
        items: [...(prev?.items ?? []), ...next.items],
        hasMore: next.hasMore,
      }));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-neutral-100 p-1 text-sm font-medium">
          {(
            [
              ["sent", "보낸 알림"],
              ["received", "받은 알림"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 transition ${
                tab === value ? "bg-white shadow-sm" : "text-neutral-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="input py-1.5 text-sm"
          value={order}
          onChange={(e) => setOrder(e.target.value as Order)}
          aria-label="정렬"
        >
          <option value="desc">최신순</option>
          <option value="asc">오래된순</option>
        </select>
      </div>

      {data === undefined ? (
        <p className="text-sm text-neutral-400">불러오는 중...</p>
      ) : data.items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-neutral-500">
          {tab === "sent" ? "아직 보낸 알림이 없어요." : "아직 받은 알림이 없어요."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((item) => {
            const statusLabel = tab === "sent" ? SENT_STATUS[item.status] : RECEIVED_STATUS[item.status];
            return (
              <li key={item.id} className="card flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {tab === "sent" ? `→ ${item.counterpartNickname}` : `${item.counterpartNickname} →`}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">{formatDateTime(item.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-neutral-700">{item.message}</p>
                {statusLabel && <p className="text-xs text-neutral-400">{statusLabel}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {data?.hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
          {loadingMore ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
