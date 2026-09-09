import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushSendResult =
  | { ok: true }
  | { ok: false; expired: boolean; error: unknown };

/**
 * 단일 구독에 웹푸시를 전송한다. 구독이 만료(404/410)되었으면
 * expired: true를 반환하므로 호출부에서 push_subscriptions row를 정리한다.
 */
export async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string }
): Promise<PushSendResult> {
  ensureConfigured();

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, expired, error };
  }
}
