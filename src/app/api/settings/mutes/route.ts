import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 내가 알림을 껐거나 켤 수 있는 대상 목록: 내가 추가한 친구 + 나를 추가한 사람 전부
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: relations, error } = await supabase
    .from("friends")
    .select("owner_id, friend_id")
    .or(`owner_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contactIds = new Set<string>();
  (relations ?? []).forEach((r) => {
    contactIds.add(r.owner_id === user.id ? r.friend_id : r.owner_id);
  });

  if (contactIds.size === 0) return NextResponse.json({ contacts: [] });

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nickname, member_code")
    .in("id", Array.from(contactIds));

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

  const { data: mutes } = await supabase.from("mutes").select("muted_id").eq("muter_id", user.id);
  const mutedIds = new Set((mutes ?? []).map((m) => m.muted_id));

  const contacts = (profiles ?? []).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    memberCode: p.member_code,
    muted: mutedIds.has(p.id),
  }));

  return NextResponse.json({ contacts });
}

// 특정 상대의 알림 on/off 토글
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const targetId = body?.targetId as string | undefined;
  const muted = body?.muted as boolean | undefined;
  if (!targetId || typeof muted !== "boolean") {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (muted) {
    const { error } = await supabase
      .from("mutes")
      .upsert({ muter_id: user.id, muted_id: targetId }, { onConflict: "muter_id,muted_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("mutes")
      .delete()
      .eq("muter_id", user.id)
      .eq("muted_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
