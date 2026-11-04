import { NextResponse, after } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";
import { notifyUser } from "@/lib/push/notify";

// 받은 친구 요청 수락 → 서로 친구
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const [{ data: requesterId, error }, { data: me }] = await Promise.all([
    supabase.rpc("accept_friend_request", { p_request_id: id }),
    supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!requesterId) return NextResponse.json({ error: "친구 요청을 찾을 수 없어요." }, { status: 404 });

  after(() =>
    notifyUser(requesterId, userId, {
      title: "렛블블",
      body: `${me?.nickname ?? "상대"}님이 친구 요청을 수락했어요!`,
      url: "/friends",
      tag: `friend-${userId}`,
    })
  );

  return NextResponse.json({ ok: true });
}

// 받은 요청 거절 또는 보낸 요청 취소
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const { data, error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", id)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "친구 요청을 찾을 수 없어요." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
