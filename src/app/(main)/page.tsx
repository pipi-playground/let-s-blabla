"use client";

import { useState } from "react";
import PushSetupBanner from "@/components/PushSetupBanner";
import ShortcutCard from "@/components/ShortcutCard";
import ShortcutFormModal from "@/components/ShortcutFormModal";
import SendPopup from "@/components/SendPopup";
import { useFriends, useShortcuts } from "@/lib/client/cache";
import type { ShortcutListItem } from "@/types/app";

export default function HomePage() {
  // 캐시된 목록을 즉시 보여주고 백그라운드에서 갱신 → 탭 이동 시 다시 로딩되지 않음
  const { data: shortcuts, mutate: setShortcuts } = useShortcuts();
  const { data: friends } = useFriends();
  const [editing, setEditing] = useState<ShortcutListItem | "new" | null>(null);
  const [sending, setSending] = useState<ShortcutListItem | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PushSetupBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">내 단축버튼</h1>
        <button onClick={() => setEditing("new")} className="btn-primary">
          + 버튼 추가
        </button>
      </div>

      {shortcuts === undefined ? (
        <p className="text-sm text-neutral-400">불러오는 중...</p>
      ) : shortcuts.length === 0 ? (
        <div className="card p-6 text-center text-sm text-neutral-500">
          아직 단축버튼이 없어요. 첫 버튼을 추가해보세요!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shortcuts.map((s) => (
            <ShortcutCard
              key={s.id}
              shortcut={s}
              onSend={() => setSending(s)}
              onEdit={() => setEditing(s)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ShortcutFormModal
          friends={friends ?? []}
          shortcut={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            // 서버가 돌려준 결과로 목록을 바로 갱신 (재조회 왕복 없음)
            setShortcuts((prev = []) =>
              prev.some((s) => s.id === saved.id)
                ? prev.map((s) => (s.id === saved.id ? saved : s))
                : [saved, ...prev]
            );
          }}
          onDeleted={(id) => {
            setEditing(null);
            setShortcuts((prev = []) => prev.filter((s) => s.id !== id));
          }}
        />
      )}

      {sending && (
        <SendPopup
          shortcut={sending}
          friends={friends ?? []}
          onClose={() => setSending(null)}
          onSent={(lastSentAt) =>
            setShortcuts((prev = []) =>
              prev.map((s) => (s.id === sending.id ? { ...s, lastSentAt } : s))
            )
          }
        />
      )}
    </div>
  );
}
