"use client";

import { useMemo, useState } from "react";
import { renderMessage, MAX_RECIPIENTS } from "@/lib/utils/message";
import type { FriendListItem, ShortcutListItem } from "@/types/app";

interface Props {
  friends: FriendListItem[];
  shortcut?: ShortcutListItem;
  onClose: () => void;
  onSaved: () => void;
}

export default function ShortcutFormModal({ friends, shortcut, onClose, onSaved }: Props) {
  const isEdit = Boolean(shortcut);
  const [name, setName] = useState(shortcut?.name ?? "");
  const [message, setMessage] = useState(shortcut?.messageTemplate ?? "");
  const [recipientIds, setRecipientIds] = useState<string[]>(
    shortcut?.defaultRecipients.map((r) => r.friendId) ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () =>
      renderMessage(message || "메시지를 입력해주세요", {
        senderNickname: "나",
        recipientNickname: recipientIds[0]
          ? friends.find((f) => f.friendId === recipientIds[0])?.nickname ?? "상대"
          : "상대",
      }),
    [message, recipientIds, friends]
  );

  function toggleRecipient(friendId: string) {
    setRecipientIds((prev) => {
      if (prev.includes(friendId)) return prev.filter((id) => id !== friendId);
      if (prev.length >= MAX_RECIPIENTS) return prev;
      return [...prev, friendId];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("버튼 이름을 입력해주세요.");
    if (!message.trim()) return setError("메시지를 입력해주세요.");

    setSaving(true);
    const res = await fetch(isEdit ? `/api/shortcuts/${shortcut!.id}` : "/api/shortcuts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), messageTemplate: message.trim(), recipientIds }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "저장에 실패했어요.");
      return;
    }

    onSaved();
  }

  async function handleDelete() {
    if (!shortcut) return;
    if (!confirm(`"${shortcut.name}" 버튼을 삭제할까요?`)) return;

    setSaving(true);
    const res = await fetch(`/api/shortcuts/${shortcut.id}`, { method: "DELETE" });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "삭제에 실패했어요.");
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? "단축버튼 수정" : "단축버튼 추가"}</h2>
          <button onClick={onClose} className="text-neutral-400" aria-label="닫기">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            버튼 이름
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="예) 밥 먹자"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            푸시 알림 메시지
            <textarea
              className="input min-h-24 resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              placeholder="예) {{me}}가 {{user}}야 밥 먹재!"
              required
            />
            <span className="text-xs font-normal text-neutral-400">
              {"{{me}}"} = 내 닉네임, {"{{user}}"} = 받는 사람 닉네임으로 자동 치환돼요.
            </span>
          </label>

          <div className="rounded-lg bg-neutral-50 p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-neutral-400">미리보기</p>
            <p>{preview}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              전송할 상대 (선택, 최대 {MAX_RECIPIENTS}명)
            </p>
            {friends.length === 0 ? (
              <p className="text-sm text-neutral-400">아직 추가한 친구가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {friends.map((friend) => (
                  <label
                    key={friend.friendId}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={recipientIds.includes(friend.friendId)}
                      onChange={() => toggleRecipient(friend.friendId)}
                      disabled={
                        !recipientIds.includes(friend.friendId) && recipientIds.length >= MAX_RECIPIENTS
                      }
                    />
                    {friend.nickname}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="mt-1 flex gap-2">
            {isEdit && (
              <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
                삭제
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
