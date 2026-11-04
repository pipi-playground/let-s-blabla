"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { FriendListItem, FriendRequestsResponse, Profile, ShortcutListItem } from "@/types/app";

/**
 * 탭(페이지)을 이동해도 유지되는 아주 작은 stale-while-revalidate 캐시.
 *
 * - 데이터는 모듈 전역 Map에 저장되므로 클라이언트 내비게이션으로 페이지가
 *   언마운트돼도 남아 있고, 다시 들어오면 즉시 이전 데이터를 보여준다.
 * - persist 키는 localStorage에도 저장해 앱을 새로 열었을 때도 바로 그려진다.
 * - 마운트 시 백그라운드에서 조용히 최신 데이터로 갱신한다(DEDUPE_MS 내 중복 요청은 생략).
 */

const STORAGE_PREFIX = "lbb:cache:";
const DEDUPE_MS = 5_000;

type Listener = () => void;

const store = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();
const inflight = new Map<string, Promise<unknown>>();
const fetchedAt = new Map<string, number>();
const hydrated = new Set<string>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function readStorage(key: string) {
  if (hydrated.has(key)) return;
  hydrated.add(key);
  if (store.has(key)) return;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) store.set(key, JSON.parse(raw));
  } catch {
    // 저장소 접근 불가(사파리 프라이빗 등) → 무시
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // 무시
  }
}

export function setCache<T>(key: string, value: T | ((prev: T | undefined) => T), persist = false) {
  const next =
    typeof value === "function" ? (value as (prev: T | undefined) => T)(store.get(key) as T | undefined) : value;
  store.set(key, next);
  if (persist) writeStorage(key, next);
  emit(key);
}

export async function revalidate<T>(key: string, fetcher: () => Promise<T>, persist = false, force = false) {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  if (!force && Date.now() - (fetchedAt.get(key) ?? 0) < DEDUPE_MS) return store.get(key) as T;

  const promise = fetcher()
    .then((data) => {
      fetchedAt.set(key, Date.now());
      setCache(key, data, persist);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** 로그아웃 시 다른 계정에 이전 사용자의 데이터가 보이지 않도록 전부 비운다. */
export function clearCache() {
  store.clear();
  fetchedAt.clear();
  hydrated.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // 무시
  }
  listeners.forEach((_, key) => emit(key));
}

export function useCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  { persist = false }: { persist?: boolean } = {}
) {
  const subscribe = useCallback(
    (listener: Listener) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(listener);
      return () => set!.delete(listener);
    },
    [key]
  );

  const data = useSyncExternalStore(
    subscribe,
    () => {
      if (persist) readStorage(key);
      return store.get(key) as T | undefined;
    },
    () => undefined
  );

  useEffect(() => {
    revalidate(key, fetcher, persist).catch(() => {});
    // fetcher는 매 렌더 새로 만들어지므로 key 기준으로만 갱신
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, persist]);

  const mutate = useCallback(
    (value: T | ((prev: T | undefined) => T)) => setCache<T>(key, value, persist),
    [key, persist]
  );

  const refresh = useCallback(
    () => revalidate(key, fetcher, persist, true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, persist]
  );

  return { data, mutate, refresh };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

// ---- 앱 전역에서 공유하는 데이터 키/조회 함수 ----

export const fetchers = {
  shortcuts: () => getJson<{ shortcuts: ShortcutListItem[] }>("/api/shortcuts").then((b) => b.shortcuts),
  friends: () => getJson<{ friends: FriendListItem[] }>("/api/friends").then((b) => b.friends),
  profile: () => getJson<{ profile: Profile }>("/api/profile").then((b) => b.profile),
  friendRequests: () => getJson<FriendRequestsResponse>("/api/friends/requests"),
};

export function useShortcuts() {
  return useCached("shortcuts", fetchers.shortcuts, { persist: true });
}
export function useFriends() {
  return useCached("friends", fetchers.friends, { persist: true });
}
export function useProfile() {
  return useCached("profile", fetchers.profile, { persist: true });
}
export function useFriendRequests() {
  return useCached("friendRequests", fetchers.friendRequests, { persist: true });
}
