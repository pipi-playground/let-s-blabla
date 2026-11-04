"use client";

import { useState } from "react";
import { revalidate, fetchers, useFriendRequests, useFriends, useProfile } from "@/lib/client/cache";

interface FoundProfile {
  id: string;
  nickname: string;
  memberCode: string;
  createdAt: string;
  alreadyFriend: boolean;
  mutualFriend: boolean;
  requestSent: boolean;
  requestReceived: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function refreshFriendData() {
  return Promise.all([
    revalidate("friends", fetchers.friends, true, true),
    revalidate("friendRequests", fetchers.friendRequests, true, true),
  ]).catch(() => {});
}

export default function FriendsPage() {
  const { data: friends, mutate: setFriends } = useFriends();
  const { data: requests, mutate: setRequests } = useFriendRequests();
  const { data: profile } = useProfile();
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [foundProfile, setFoundProfile] = useState<FoundProfile | null>(null);
  const [busy, setBusy] = useState<"request" | "add" | null>(null);
  const [handlingId, setHandlingId] = useState<string | null>(null);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setNotice(null);
    setFoundProfile(null);

    if (!/^\d{4}$/.test(code)) {
      setSearchError("숫자 4자리 회원코드를 입력해주세요.");
      return;
    }

    setSearching(true);
    const res = await fetch(`/api/friends/lookup?code=${code}`);
    const body = await res.json().catch(() => ({}));
    setSearching(false);

    if (!res.ok) {
      setSearchError(body.error ?? "조회에 실패했어요.");
      return;
    }

    setFoundProfile(body.profile);
  }

  function resetSearch() {
    setCode("");
    setFoundProfile(null);
  }

  // 친구 요청: 상대가 수락하면 서로 친구
  async function handleRequest() {
    if (!foundProfile) return;
    setBusy("request");
    setSearchError(null);
    const res = await fetch("/api/friends/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCode: foundProfile.memberCode }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setSearchError(body.error ?? "친구 요청에 실패했어요.");
      return;
    }

    setNotice(
      body.result === "accepted"
        ? `${foundProfile.nickname}님과 서로 친구가 됐어요!`
        : `${foundProfile.nickname}님에게 친구 요청을 보냈어요.`
    );
    resetSearch();
    refreshFriendData();
  }

  // 기존 방식: 회원코드로 바로 추가 (단방향)
  async function handleDirectAdd() {
    if (!foundProfile) return;
    setBusy("add");
    setSearchError(null);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCode: foundProfile.memberCode }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setSearchError(body.error ?? "친구 추가에 실패했어요.");
      return;
    }

    setFriends((prev = []) => [body.friend, ...prev]);
    setNotice(`${foundProfile.nickname}님을 친구 목록에 추가했어요.`);
    resetSearch();
  }

  async function handleAccept(id: string) {
    setHandlingId(id);
    const res = await fetch(`/api/friends/requests/${id}`, { method: "POST" });
    setHandlingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "수락에 실패했어요.");
    }
    refreshFriendData();
  }

  async function handleRejectOrCancel(id: string, kind: "incoming" | "outgoing") {
    if (kind === "incoming" && !confirm("친구 요청을 거절할까요?")) return;
    setRequests((prev) =>
      prev
        ? {
            incoming: prev.incoming.filter((r) => r.id !== id),
            outgoing: prev.outgoing.filter((r) => r.id !== id),
          }
        : { incoming: [], outgoing: [] }
    );
    await fetch(`/api/friends/requests/${id}`, { method: "DELETE" });
  }

  async function handleRemove(id: string) {
    if (!confirm("친구를 삭제할까요?")) return;
    setFriends((prev = []) => prev.filter((f) => f.id !== id));
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    // 기본 전송 대상에서도 빠지므로 단축버튼 목록 갱신
    revalidate("shortcuts", fetchers.shortcuts, true, true).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4 text-sm">
        <p className="text-neutral-500">내 회원코드</p>
        <p className="mt-1 text-2xl font-bold tracking-widest">{profile?.member_code ?? "----"}</p>
        <p className="mt-1 text-xs text-neutral-400">친구에게 이 코드를 알려주면 추가할 수 있어요.</p>
      </div>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            받은 친구 요청 <span className="text-red-500">{incoming.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {incoming.map((r) => (
              <li key={r.id} className="card flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.nickname}</p>
                  <p className="text-xs text-neutral-400">
                    코드 {r.memberCode} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleRejectOrCancel(r.id, "incoming")}
                    disabled={handlingId === r.id}
                    className="btn-secondary px-3 py-2"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => handleAccept(r.id)}
                    disabled={handlingId === r.id}
                    className="btn-primary px-3 py-2"
                  >
                    {handlingId === r.id ? "수락 중..." : "수락"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="input min-w-0 flex-1"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
              setFoundProfile(null);
              setNotice(null);
            }}
            placeholder="상대 회원코드 4자리"
            inputMode="numeric"
          />
          <button type="submit" disabled={searching} className="btn-primary">
            {searching ? "검색 중..." : "검색"}
          </button>
        </form>
        {searchError && <p className="mt-2 text-sm text-red-500">{searchError}</p>}
        {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}

        {foundProfile && (
          <div className="card mt-3 flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl">
                👤
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{foundProfile.nickname}</p>
                <p className="text-xs text-neutral-400">{formatDate(foundProfile.createdAt)} 가입</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRequest}
                disabled={busy !== null || foundProfile.mutualFriend || foundProfile.requestSent}
                className="btn-primary flex-1"
              >
                {foundProfile.mutualFriend
                  ? "이미 서로 친구"
                  : foundProfile.requestSent
                    ? "요청 보냄"
                    : busy === "request"
                      ? "요청 중..."
                      : foundProfile.requestReceived
                        ? "요청 수락하기"
                        : "친구 요청"}
              </button>
              <button
                onClick={handleDirectAdd}
                disabled={busy !== null || foundProfile.alreadyFriend}
                className="btn-secondary flex-1"
              >
                {foundProfile.alreadyFriend ? "이미 추가됨" : busy === "add" ? "추가 중..." : "바로 추가"}
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              친구 요청: 상대가 수락하면 서로 친구가 돼요. · 바로 추가: 내 목록에만 추가돼요.
            </p>
          </div>
        )}
      </div>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">보낸 친구 요청</h2>
          <ul className="flex flex-col gap-2">
            {outgoing.map((r) => (
              <li key={r.id} className="card flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.nickname}</p>
                  <p className="text-xs text-neutral-400">수락 대기 중 · {formatDate(r.createdAt)}</p>
                </div>
                <button onClick={() => handleRejectOrCancel(r.id, "outgoing")} className="btn-danger shrink-0">
                  취소
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">추가한 친구</h2>
        {friends === undefined ? (
          <p className="text-sm text-neutral-400">불러오는 중...</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 추가한 친구가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li key={f.id} className="card flex items-center justify-between px-4 py-3 text-sm">
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
