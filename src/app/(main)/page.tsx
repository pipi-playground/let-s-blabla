"use client";

import { useCallback, useEffect, useState } from "react";
import PushSetupBanner from "@/components/PushSetupBanner";
import ShortcutCard from "@/components/ShortcutCard";
import ShortcutFormModal from "@/components/ShortcutFormModal";
import SendPopup from "@/components/SendPopup";
import type { FriendListItem, ShortcutListItem } from "@/types/app";

export default function HomePage() {
  const [shortcuts, setShortcuts] = useState<ShortcutListItem[] | null>(null);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [editing, setEditing] = useState<ShortcutListItem | "new" | null>(null);
  const [sending, setSending] = useState<ShortcutListItem | null>(null);

  const load = useCallback(async () => {
    const [shortcutsRes, friendsRes] = await Promise.all([
      fetch("/api/shortcuts"),
      fetch("/api/friends"),
    ]);
    const shortcutsBody = await shortcutsRes.json();
    const friendsBody = await friendsRes.json();
    setShortcuts(shortcutsBody.shortcuts ?? []);
    setFriends(friendsBody.friends ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 초기 데이터 로드
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <PushSetupBanner />

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">내 단축버튼</h1>
        <button onClick={() => setEditing("new")} className="btn-primary">
          + 버튼 추가
        </button>
      </div>

      {shortcuts === null ? (
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
          friends={friends}
          shortcut={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {sending && <SendPopup shortcut={sending} friends={friends} onClose={() => setSending(null)} />}
    </div>
  );
}
