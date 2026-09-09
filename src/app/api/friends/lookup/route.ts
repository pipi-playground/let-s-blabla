import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 회원코드로 상대 프로필을 미리 조회 (친구 추가 확정 전 미리보기용)
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const memberCode = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{4}$/.test(memberCode)) {
    return NextResponse.json({ error: "회원코드는 숫자 4자리예요." }, { status: 400 });
  }

  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, nickname, member_code, created_at")
    .eq("member_code", memberCode)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "해당 회원코드를 찾을 수 없어요." }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: "본인은 추가할 수 없어요." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("friends")
    .select("id")
    .eq("owner_id", user.id)
    .eq("friend_id", target.id)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      id: target.id,
      nickname: target.nickname,
      memberCode: target.member_code,
      createdAt: target.created_at,
      alreadyFriend: Boolean(existing),
    },
  });
}
