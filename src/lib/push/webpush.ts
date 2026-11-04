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

export interface PushPayload {
  title: string;
  body: string;
  /** 알림을 눌렀을 때 열 경로 (기본 "/") */
  url?: string;
  /** 같은 tag 알림은 서로 덮어씀 */
  tag?: string;
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
  payload: PushPayload
): Promise<PushSendResult> {
  ensureConfigured();

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      {
        // 즉시 전달 우선 (모바일 절전 상태에서도 지연 최소화), 1시간 지나면 폐기
        urgency: "high",
        TTL: 60 * 60,
        // 푸시 서비스 응답이 늦어도 API 응답이 무한정 길어지지 않도록
        timeout: 8000,
      }
    );
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, expired, error };
  }
}

/** 여러 구독에 병렬 발송하고, 하나라도 성공했는지와 만료된 구독 id 목록을 돌려준다. */
export async function sendPushToSubscriptions(subs: PushSubscriptionRow[], payload: PushPayload) {
  const results = await Promise.all(subs.map((sub) => sendPushToSubscription(sub, payload)));
  const expiredIds = subs.filter((_, i) => {
    const r = results[i];
    return !r.ok && r.expired;
  }).map((s) => s.id);
  return { anyOk: results.some((r) => r.ok), expiredIds };
}
