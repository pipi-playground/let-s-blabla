import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

// 회원코드로 상대 프로필을 미리 조회 (친구 추가/요청 확정 전 미리보기용)
export async function GET(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

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
  if (target.id === userId) {
    return NextResponse.json({ error: "본인은 추가할 수 없어요." }, { status: 400 });
  }

  const [{ data: relations }, { data: requests }] = await Promise.all([
    supabase
      .from("friends")
      .select("owner_id")
      .or(`and(owner_id.eq.${userId},friend_id.eq.${target.id}),and(owner_id.eq.${target.id},friend_id.eq.${userId})`),
    supabase
      .from("friend_requests")
      .select("requester_id")
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${userId})`),
  ]);

  const alreadyFriend = (relations ?? []).some((r) => r.owner_id === userId);
  const theyAddedMe = (relations ?? []).some((r) => r.owner_id === target.id);
  const requestSent = (requests ?? []).some((r) => r.requester_id === userId);
  const requestReceived = (requests ?? []).some((r) => r.requester_id === target.id);

  return NextResponse.json({
    profile: {
      id: target.id,
      nickname: target.nickname,
      memberCode: target.member_code,
      createdAt: target.created_at,
      alreadyFriend,
      mutualFriend: alreadyFriend && theyAddedMe,
      requestSent,
      requestReceived,
    },
  });
}
