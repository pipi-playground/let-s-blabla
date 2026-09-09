"use client";

import { useEffect, useState } from "react";

interface Contact {
  id: string;
  nickname: string;
  memberCode: string;
  muted: boolean;
}

interface DndSettings {
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export default function SettingsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [dnd, setDnd] = useState<DndSettings | null>(null);
  const [dndSaving, setDndSaving] = useState(false);

  async function loadContacts() {
    const res = await fetch("/api/settings/mutes");
    const body = await res.json();
    setContacts(body.contacts ?? []);
  }

  async function loadDnd() {
    const res = await fetch("/api/settings/dnd");
    const body = await res.json();
    setDnd({
      enabled: body.settings.enabled,
      start_time: body.settings.start_time?.slice(0, 5) ?? "23:00",
      end_time: body.settings.end_time?.slice(0, 5) ?? "08:00",
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 초기 데이터 로드
    loadContacts();
    loadDnd();
  }, []);

  async function toggleMute(contact: Contact) {
    setContacts((prev) =>
      prev ? prev.map((c) => (c.id === contact.id ? { ...c, muted: !c.muted } : c)) : prev
    );
    await fetch("/api/settings/mutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: contact.id, muted: !contact.muted }),
    });
  }

  async function saveDnd(next: DndSettings) {
    setDnd(next);
    setDndSaving(true);
    await fetch("/api/settings/dnd", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next.enabled, startTime: next.start_time, endTime: next.end_time }),
    });
    setDndSaving(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">방해금지 시간대</h2>
        {dnd && (
          <div className="card flex flex-col gap-3 p-4 text-sm">
            <label className="flex items-center justify-between">
              <span>방해금지 시간대 사용</span>
              <input
                type="checkbox"
                checked={dnd.enabled}
                onChange={(e) => saveDnd({ ...dnd, enabled: e.target.checked })}
              />
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                className="input"
                value={dnd.start_time}
                disabled={!dnd.enabled}
                onChange={(e) => saveDnd({ ...dnd, start_time: e.target.value })}
              />
              <span className="text-neutral-400">~</span>
              <input
                type="time"
                className="input"
                value={dnd.end_time}
                disabled={!dnd.enabled}
                onChange={(e) => saveDnd({ ...dnd, end_time: e.target.value })}
              />
            </div>
            <p className="text-xs text-neutral-400">
              이 시간 동안은 친구가 보낸 알림이 오지 않아요. {dndSaving && "저장 중..."}
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">상대별 알림 설정</h2>
        {contacts === null ? (
          <p className="text-sm text-neutral-400">불러오는 중...</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 친구 관계가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {contacts.map((c) => (
              <li key={c.id} className="card flex items-center justify-between px-4 py-3 text-sm">
                <span>{c.nickname}</span>
                <label className="flex items-center gap-2 text-xs text-neutral-500">
                  {c.muted ? "알림 꺼짐" : "알림 켜짐"}
                  <input type="checkbox" checked={!c.muted} onChange={() => toggleMute(c)} />
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
