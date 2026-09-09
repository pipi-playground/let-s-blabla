import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToSubscription } from "@/lib/push/webpush";
import { renderMessage, MAX_RECIPIENTS } from "@/lib/utils/message";
import { isWithinDnd } from "@/lib/utils/dnd";
import type { SendLogStatus } from "@/types/database";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

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

  const { data: shortcut, error: shortcutError } = await supabase
    .from("shortcuts")
    .select("id, name, message_template, cooldown_seconds, last_sent_at")
    .eq("id", shortcutId)
    .eq("owner_id", user.id)
    .single();

  if (shortcutError || !shortcut) {
    return NextResponse.json({ error: "단축버튼을 찾을 수 없어요." }, { status: 404 });
  }

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

  // recipientIds가 실제로 내 친구 목록에 속하는지 검증
  const { data: friendRows, error: friendsError } = await supabase
    .from("friends")
    .select("friend_id")
    .eq("owner_id", user.id)
    .in("friend_id", recipientIds);

  if (friendsError) return NextResponse.json({ error: friendsError.message }, { status: 500 });

  const validRecipientIds = new Set((friendRows ?? []).map((f) => f.friend_id));
  const invalidIds = recipientIds.filter((id) => !validRecipientIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: "친구 목록에 없는 상대가 포함되어 있어요." }, { status: 400 });
  }

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();
  const senderNickname = senderProfile?.nickname ?? "블블이";

  const admin = createAdminClient();

  const [{ data: recipientProfiles }, { data: mutes }, { data: dndRows }, { data: subs }] =
    await Promise.all([
      admin.from("profiles").select("id, nickname").in("id", recipientIds),
      admin.from("mutes").select("muter_id, muted_id").eq("muted_id", user.id).in("muter_id", recipientIds),
      admin.from("dnd_settings").select("*").in("user_id", recipientIds),
      admin.from("push_subscriptions").select("*").in("user_id", recipientIds),
    ]);

  const nicknameById = new Map((recipientProfiles ?? []).map((p) => [p.id, p.nickname]));
  const mutedBySet = new Set((mutes ?? []).map((m) => m.muter_id));
  const dndById = new Map((dndRows ?? []).map((d) => [d.user_id, d]));
  const subsByUser = new Map<string, typeof subs>();
  (subs ?? []).forEach((s) => {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  });

  const logs: {
    shortcut_id: string;
    sender_id: string;
    recipient_id: string;
    message: string;
    status: SendLogStatus;
  }[] = [];
  const results: { recipientId: string; nickname: string; status: SendLogStatus }[] = [];
  const expiredSubIds: string[] = [];

  for (const recipientId of recipientIds) {
    const recipientNickname = nicknameById.get(recipientId) ?? "친구";
    const message = renderMessage(shortcut.message_template, { senderNickname, recipientNickname });

    let status: SendLogStatus;

    if (mutedBySet.has(recipientId)) {
      status = "muted";
    } else if (dndById.has(recipientId) && isWithinDnd(dndById.get(recipientId)!)) {
      status = "dnd";
    } else {
      const recipientSubs = subsByUser.get(recipientId) ?? [];
      if (recipientSubs.length === 0) {
        status = "no_subscription";
      } else {
        const sendResults = await Promise.all(
          recipientSubs.map(async (sub) => {
            const result = await sendPushToSubscription(sub, { title: senderNickname, body: message });
            if (!result.ok && result.expired) expiredSubIds.push(sub.id);
            return result.ok;
          })
        );
        status = sendResults.some(Boolean) ? "sent" : "failed";
      }
    }

    logs.push({
      shortcut_id: shortcut.id,
      sender_id: user.id,
      recipient_id: recipientId,
      message,
      status,
    });
    results.push({ recipientId, nickname: recipientNickname, status });
  }

  await Promise.all([
    admin.from("send_logs").insert(logs),
    expiredSubIds.length > 0
      ? admin.from("push_subscriptions").delete().in("id", expiredSubIds)
      : Promise.resolve(),
    supabase.from("shortcuts").update({ last_sent_at: new Date().toISOString() }).eq("id", shortcut.id),
  ]);

  return NextResponse.json({ results });
}
