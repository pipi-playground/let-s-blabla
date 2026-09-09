import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 내가 추가한 친구 목록 (뮤트 여부 포함)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: friends, error } = await supabase
    .from("friends")
    .select("id, friend_id, created_at, friend:profiles!friends_friend_id_fkey(id, nickname, member_code)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: mutes } = await supabase.from("mutes").select("muted_id").eq("muter_id", user.id);
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

// 회원코드로 친구 추가
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

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
  if (target.id === user.id) {
    return NextResponse.json({ error: "본인은 추가할 수 없어요." }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("friends")
    .insert({ owner_id: user.id, friend_id: target.id });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "이미 추가한 친구예요." }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    friend: { friendId: target.id, nickname: target.nickname, memberCode: target.member_code },
  });
}
