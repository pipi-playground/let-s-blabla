import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

// 내가 알림을 껐거나 켤 수 있는 대상 목록: 내가 추가한 친구 + 나를 추가한 사람 전부
export async function GET() {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  type P = { id: string; nickname: string; member_code: string } | null;

  const [{ data: relations, error }, { data: mutes }] = await Promise.all([
    supabase
      .from("friends")
      .select(
        "owner_id, friend_id, owner:profiles!friends_owner_id_fkey(id, nickname, member_code), friend:profiles!friends_friend_id_fkey(id, nickname, member_code)"
      )
      .or(`owner_id.eq.${userId},friend_id.eq.${userId}`),
    supabase.from("mutes").select("muted_id").eq("muter_id", userId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mutedIds = new Set((mutes ?? []).map((m) => m.muted_id));
  const byId = new Map<string, { id: string; nickname: string; memberCode: string; muted: boolean }>();
  (relations ?? []).forEach((r) => {
    const p = (r.owner_id === userId ? r.friend : r.owner) as unknown as P;
    if (!p || byId.has(p.id)) return;
    byId.set(p.id, { id: p.id, nickname: p.nickname, memberCode: p.member_code, muted: mutedIds.has(p.id) });
  });
  const contacts = Array.from(byId.values());

  return NextResponse.json({ contacts });
}

// 특정 상대의 알림 on/off 토글
export async function POST(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const targetId = body?.targetId as string | undefined;
  const muted = body?.muted as boolean | undefined;
  if (!targetId || typeof muted !== "boolean") {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (muted) {
    const { error } = await supabase
      .from("mutes")
      .upsert({ muter_id: userId, muted_id: targetId }, { onConflict: "muter_id,muted_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("mutes")
      .delete()
      .eq("muter_id", userId)
      .eq("muted_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
