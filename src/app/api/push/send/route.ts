import { NextResponse, after } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToSubscriptions } from "@/lib/push/webpush";
import { renderMessage, MAX_RECIPIENTS } from "@/lib/utils/message";
import { isWithinDnd } from "@/lib/utils/dnd";
import type { SendLogStatus } from "@/types/database";

export async function POST(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const shortcutId = body?.shortcutId as string | undefined;
  const recipientIds: string[] = Array.from(
    new Set((Array.isArray(body?.recipientIds) ? body.recipientIds : []) as string[])
  );

  if (!shortcutId) return NextResponse.json({ error: "shortcutId가 필요해요." }, { status: 400 });
  if (recipientIds.length === 0) {
    return NextResponse.json({ error: "보낼 상대를 1명 이상 선택해주세요." }, { status: 400 });
  }
  if (recipientIds.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `한 번에 최대 ${MAX_RECIPIENTS}명까지 보낼 수 있어요.` }, { status: 400 });
  }

  const admin = createAdminClient();

  // 검증용 조회와 수신자 정보 조회를 한 번에 병렬로 실행 (DB 왕복 1회 분량).
  // 수신자 정보는 service role로 읽지만, 아래에서 친구 관계 검증을 통과해야만 사용한다.
  const [
    { data: shortcut, error: shortcutError },
    { data: friendRows, error: friendsError },
    { data: senderProfile },
    { data: recipientProfiles },
    { data: mutes },
    { data: dndRows },
    { data: subs },
  ] = await Promise.all([
    supabase
      .from("shortcuts")
      .select("id, name, message_template, cooldown_seconds, last_sent_at")
      .eq("id", shortcutId)
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase.from("friends").select("friend_id").eq("owner_id", userId).in("friend_id", recipientIds),
    supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle(),
    admin.from("profiles").select("id, nickname").in("id", recipientIds),
    admin.from("mutes").select("muter_id").eq("muted_id", userId).in("muter_id", recipientIds),
    admin.from("dnd_settings").select("*").in("user_id", recipientIds),
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", recipientIds),
  ]);

  if (shortcutError) return NextResponse.json({ error: shortcutError.message }, { status: 500 });
  if (!shortcut) return NextResponse.json({ error: "단축버튼을 찾을 수 없어요." }, { status: 404 });

  if (shortcut.last_sent_at) {
    const elapsedMs = Date.now() - new Date(shortcut.last_sent_at).getTime();
    const remainingMs = shortcut.cooldown_seconds * 1000 - elapsedMs;
    if (remainingMs > 0) {
      return NextResponse.json(
        { error: "쿨다운 중이에요.", remainingSeconds: Math.ceil(remainingMs / 1000) },
        { status: 429 }
      );
    }
  }

  if (friendsError) return NextResponse.json({ error: friendsError.message }, { status: 500 });
  const validRecipientIds = new Set((friendRows ?? []).map((f) => f.friend_id));
  if (recipientIds.some((id) => !validRecipientIds.has(id))) {
    return NextResponse.json({ error: "친구 목록에 없는 상대가 포함되어 있어요." }, { status: 400 });
  }

  const sentAt = new Date().toISOString();
  // 쿨다운 기준 시각은 푸시 발송과 동시에 기록 (응답 지연 없음)
  const cooldownUpdate = supabase.from("shortcuts").update({ last_sent_at: sentAt }).eq("id", shortcut.id);

  const senderNickname = senderProfile?.nickname ?? "블블이";
  const nicknameById = new Map((recipientProfiles ?? []).map((p) => [p.id, p.nickname]));
  const mutedBySet = new Set((mutes ?? []).map((m) => m.muter_id));
  const dndById = new Map((dndRows ?? []).map((d) => [d.user_id, d]));
  const subsByUser = new Map<string, NonNullable<typeof subs>>();
  (subs ?? []).forEach((s) => {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  });

  const expiredSubIds: string[] = [];

  // 수신자별 발송을 모두 병렬로 처리
  const results = await Promise.all(
    recipientIds.map(async (recipientId) => {
      const nickname = nicknameById.get(recipientId) ?? "친구";
      const message = renderMessage(shortcut.message_template, {
        senderNickname,
        recipientNickname: nickname,
      });

      let status: SendLogStatus;
      const dnd = dndById.get(recipientId);
      const recipientSubs = subsByUser.get(recipientId) ?? [];

      if (mutedBySet.has(recipientId)) {
        status = "muted";
      } else if (dnd && isWithinDnd(dnd)) {
        status = "dnd";
      } else if (recipientSubs.length === 0) {
        status = "no_subscription";
      } else {
        const { anyOk, expiredIds } = await sendPushToSubscriptions(recipientSubs, {
          title: senderNickname,
          body: message,
          url: "/history?tab=received",
        });
        expiredSubIds.push(...expiredIds);
        status = anyOk ? "sent" : "failed";
      }

      return { recipientId, nickname, status, message };
    })
  );

  await cooldownUpdate;

  // 기록 저장 / 만료 구독 정리는 응답을 보낸 뒤에 처리
  after(async () => {
    await Promise.all([
      admin.from("send_logs").insert(
        results.map((r) => ({
          shortcut_id: shortcut.id,
          sender_id: userId,
          recipient_id: r.recipientId,
          message: r.message,
          status: r.status,
          created_at: sentAt,
        }))
      ),
      expiredSubIds.length > 0
        ? admin.from("push_subscriptions").delete().in("id", expiredSubIds)
        : Promise.resolve(),
    ]);
  });

  return NextResponse.json({
    results: results.map(({ recipientId, nickname, status }) => ({ recipientId, nickname, status })),
    lastSentAt: sentAt,
  });
}
