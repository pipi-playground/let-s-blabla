import { createAdminClient } from "@/lib/supabase/admin";
import { isWithinDnd } from "@/lib/utils/dnd";
import { sendPushToSubscriptions, type PushPayload } from "./webpush";

/**
 * 한 사용자에게 시스템 알림(친구 요청 등)을 보낸다.
 * 받는 사람이 보낸 사람을 뮤트했거나 방해금지 시간대면 보내지 않는다.
 * 응답을 막지 않도록 after() 안에서 호출하는 것을 전제로 한다.
 */
export async function notifyUser(targetId: string, fromId: string, payload: PushPayload) {
  const admin = createAdminClient();

  const [{ data: mute }, { data: dnd }, { data: subs }] = await Promise.all([
    admin.from("mutes").select("muter_id").eq("muter_id", targetId).eq("muted_id", fromId).maybeSingle(),
    admin.from("dnd_settings").select("*").eq("user_id", targetId).maybeSingle(),
    admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", targetId),
  ]);

  if (mute || (dnd && isWithinDnd(dnd)) || !subs || subs.length === 0) return;

  const { expiredIds } = await sendPushToSubscriptions(subs, payload);
  if (expiredIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expiredIds);
  }
}
