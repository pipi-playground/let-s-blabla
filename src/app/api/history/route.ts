import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";
import type { HistoryItem } from "@/types/app";

const PAGE_SIZE = 30;

type ProfileEmbed = { nickname: string } | null;

// 알림 기록: type=sent(보낸 것) | received(받은 것), order=desc(최신순) | asc(오래된순), offset
export async function GET(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const params = new URL(request.url).searchParams;
  const type = params.get("type") === "received" ? "received" : "sent";
  const ascending = params.get("order") === "asc";
  const offset = Math.max(0, Number(params.get("offset")) || 0);

  const query =
    type === "sent"
      ? supabase
          .from("send_logs")
          .select(
            "id, message, status, created_at, counterpart_id:recipient_id, counterpart:profiles!send_logs_recipient_id_fkey(nickname)"
          )
          .eq("sender_id", userId)
      : supabase
          .from("send_logs")
          .select(
            "id, message, status, created_at, counterpart_id:sender_id, counterpart:profiles!send_logs_sender_id_fkey(nickname)"
          )
          .eq("recipient_id", userId);

  // 한 개 더 가져와서 다음 페이지 존재 여부 판단
  const { data, error } = await query
    .order("created_at", { ascending })
    .order("id", { ascending })
    .range(offset, offset + PAGE_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const items: HistoryItem[] = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    counterpartId: r.counterpart_id,
    counterpartNickname: (r.counterpart as unknown as ProfileEmbed)?.nickname ?? "알 수 없음",
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ items, hasMore: rows.length > PAGE_SIZE });
}
