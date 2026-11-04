"use client";

import { useState } from "react";
import { MAX_RECIPIENTS } from "@/lib/utils/message";
import type { FriendListItem, SendResult, ShortcutListItem } from "@/types/app";

const STATUS_LABEL: Record<SendResult["status"], string> = {
  sent: "✅ 전송됨",
  muted: "🔕 알림 꺼둠",
  dnd: "🌙 방해금지 시간",
  failed: "⚠️ 전송 실패",
  no_subscription: "📵 미접속 (알림 미설정)",
};

interface Props {
  shortcut: ShortcutListItem;
  friends: FriendListItem[];
  onClose: () => void;
  onSent: (lastSentAt: string) => void;
}

export default function SendPopup({ shortcut, friends, onClose, onSent }: Props) {
  const [selected, setSelected] = useState<string[]>(
    shortcut.defaultRecipients.map((r) => r.friendId)
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);

  function toggle(friendId: string) {
    setSelected((prev) => {
      if (prev.includes(friendId)) return prev.filter((id) => id !== friendId);
      if (prev.length >= MAX_RECIPIENTS) return prev;
      return [...prev, friendId];
    });
  }

  async function handleSend() {
    setError(null);
    if (selected.length === 0) {
      setError("보낼 상대를 선택해주세요.");
      return;
    }

    setSending(true);
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortcutId: shortcut.id, recipientIds: selected }),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      if (res.status === 429) {
        setError(`쿨다운 중이에요. ${body.remainingSeconds}초 후 다시 시도해주세요.`);
      } else {
        setError(body.error ?? "전송에 실패했어요.");
      }
      return;
    }

    setResults(body.results);
    if (body.lastSentAt) onSent(body.lastSentAt);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{shortcut.name}</h2>
          <button onClick={onClose} className="text-neutral-400" aria-label="닫기">
            ✕
          </button>
        </div>

        {results ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-500">전송 결과</p>
            <ul className="flex flex-col gap-2">
              {results.map((r) => (
                <li
                  key={r.recipientId}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  <span>{r.nickname}</span>
                  <span>{STATUS_LABEL[r.status]}</span>
                </li>
              ))}
            </ul>
            <button onClick={onClose} className="btn-primary mt-1">
              확인
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-neutral-500">
              받을 사람을 선택해주세요 (최대 {MAX_RECIPIENTS}명)
            </p>
            {friends.length === 0 ? (
              <p className="text-sm text-neutral-400">아직 추가한 친구가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {friends.map((friend) => {
                  const checked = selected.includes(friend.friendId);
                  return (
                    <label
                      key={friend.friendId}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                        checked ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                      }`}
                    >
                      <span>{friend.nickname}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(friend.friendId)}
                        disabled={!checked && selected.length >= MAX_RECIPIENTS}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSend}
              disabled={sending || friends.length === 0}
              className="btn-primary mt-4 w-full"
            >
              {sending ? "전송 중..." : `${selected.length}명에게 전송`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
