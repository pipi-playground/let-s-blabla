import { NextResponse, after } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";
import { notifyUser } from "@/lib/push/notify";

type ProfileEmbed = { id: string; nickname: string; member_code: string } | null;

// 받은 요청 / 보낸 요청 목록
export async function GET() {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const { data, error } = await supabase
    .from("friend_requests")
    .select(
      "id, requester_id, addressee_id, created_at, requester:profiles!friend_requests_requester_id_fkey(id, nickname, member_code), addressee:profiles!friend_requests_addressee_id_fkey(id, nickname, member_code)"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const toItem = (id: string, createdAt: string, p: ProfileEmbed) => ({
    id,
    userId: p?.id ?? "",
    nickname: p?.nickname ?? "알 수 없음",
    memberCode: p?.member_code ?? "",
    createdAt,
  });

  const incoming = (data ?? [])
    .filter((r) => r.addressee_id === userId)
    .map((r) => toItem(r.id, r.created_at, r.requester as unknown as ProfileEmbed));
  const outgoing = (data ?? [])
    .filter((r) => r.requester_id === userId)
    .map((r) => toItem(r.id, r.created_at, r.addressee as unknown as ProfileEmbed));

  return NextResponse.json({ incoming, outgoing });
}

const RESULT_ERRORS: Record<string, { message: string; status: number }> = {
  not_found: { message: "해당 회원코드를 찾을 수 없어요.", status: 404 },
  self: { message: "본인에게는 요청할 수 없어요.", status: 400 },
  already_friends: { message: "이미 서로 친구예요.", status: 409 },
  already_requested: { message: "이미 친구 요청을 보냈어요.", status: 409 },
};

// 회원코드로 친구 요청 보내기 (상대가 수락하면 서로 친구)
export async function POST(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const memberCode = (body?.memberCode ?? "").trim();
  if (!/^\d{4}$/.test(memberCode)) {
    return NextResponse.json({ error: "회원코드는 숫자 4자리예요." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("send_friend_request", { p_member_code: memberCode });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as unknown as {
    result: string;
    target_id?: string;
    target_nickname?: string;
    my_nickname?: string;
  };

  const mapped = RESULT_ERRORS[result.result];
  if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });

  const myNickname = result.my_nickname ?? "누군가";
  const targetId = result.target_id!;

  after(() =>
    notifyUser(
      targetId,
      userId,
      result.result === "accepted"
        ? {
            title: "렛블블",
            body: `${myNickname}님과 서로 친구가 됐어요!`,
            url: "/friends",
            tag: `friend-${userId}`,
          }
        : {
            title: "렛블블 친구 요청",
            body: `${myNickname}님이 푸시알림을 보내겠다는데 받으셔야겠죠?`,
            url: "/friends",
            tag: `friend-${userId}`,
          }
    )
  );

  return NextResponse.json({ result: result.result, nickname: result.target_nickname });
}
