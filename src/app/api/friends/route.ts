import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

// 내가 추가한 친구 목록 (뮤트 여부 포함)
export async function GET() {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const [{ data: friends, error }, { data: mutes }] = await Promise.all([
    supabase
      .from("friends")
      .select("id, friend_id, created_at, friend:profiles!friends_friend_id_fkey(id, nickname, member_code)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("mutes").select("muted_id").eq("muter_id", userId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mutedIds = new Set((mutes ?? []).map((m) => m.muted_id));

  const result = (friends ?? []).map((f) => ({
    id: f.id,
    friendId: f.friend_id,
    nickname: (f.friend as unknown as { nickname: string })?.nickname,
    memberCode: (f.friend as unknown as { member_code: string })?.member_code,
    createdAt: f.created_at,
    muted: mutedIds.has(f.friend_id),
  }));

  return NextResponse.json({ friends: result });
}

// 회원코드로 바로 추가 (단방향, 기존 방식 유지)
export async function POST(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const memberCode = (body?.memberCode ?? "").trim();

  if (!/^\d{4}$/.test(memberCode)) {
    return NextResponse.json({ error: "회원코드는 숫자 4자리예요." }, { status: 400 });
  }

  const { data: target, error: findError } = await supabase
    .from("profiles")
    .select("id, nickname, member_code")
    .eq("member_code", memberCode)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "해당 회원코드를 찾을 수 없어요." }, { status: 404 });
  if (target.id === userId) {
    return NextResponse.json({ error: "본인은 추가할 수 없어요." }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("friends")
    .insert({ owner_id: userId, friend_id: target.id })
    .select("id, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "이미 추가한 친구예요." }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    friend: {
      id: inserted.id,
      friendId: target.id,
      nickname: target.nickname,
      memberCode: target.member_code,
      createdAt: inserted.created_at,
      muted: false,
    },
  });
}
