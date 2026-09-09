"use client";

import { useEffect, useState } from "react";
import type { FriendListItem } from "@/types/app";
import { createClient } from "@/lib/supabase/client";

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendListItem[] | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch("/api/friends");
    const body = await res.json();
    setFriends(body.friends ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 초기 데이터 로드
    load();
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("member_code").eq("id", user.id).single();
      if (data) setMyCode(data.member_code);
    });
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(code)) {
      setError("숫자 4자리 회원코드를 입력해주세요.");
      return;
    }

    setAdding(true);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCode: code }),
    });
    const body = await res.json().catch(() => ({}));
    setAdding(false);

    if (!res.ok) {
      setError(body.error ?? "친구 추가에 실패했어요.");
      return;
    }

    setCode("");
    load();
  }

  async function handleRemove(id: string) {
    if (!confirm("친구를 삭제할까요?")) return;
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4 text-sm">
        <p className="text-neutral-500">내 회원코드</p>
        <p className="mt-1 text-2xl font-bold tracking-widest">{myCode ?? "----"}</p>
        <p className="mt-1 text-xs text-neutral-400">친구에게 이 코드를 알려주면 추가할 수 있어요.</p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="input flex-1"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="상대 회원코드 4자리"
          inputMode="numeric"
        />
        <button type="submit" disabled={adding} className="btn-primary">
          추가
        </button>
      </form>
      {error && <p className="-mt-4 text-sm text-red-500">{error}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">추가한 친구</h2>
        {friends === null ? (
          <p className="text-sm text-neutral-400">불러오는 중...</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 추가한 친구가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li
                key={f.id}
                className="card flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{f.nickname}</p>
                  <p className="text-xs text-neutral-400">코드 {f.memberCode}</p>
                </div>
                <button onClick={() => handleRemove(f.id)} className="btn-danger">
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
