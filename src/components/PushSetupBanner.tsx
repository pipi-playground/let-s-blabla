"use client";

import { useEffect, useState } from "react";
import { isIos, isStandalonePwa, registerServiceWorker, subscribeToPush } from "@/lib/utils/push-client";

export default function PushSetupBanner() {
  const [needsInstall, setNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    registerServiceWorker().catch(() => {});

    if (isIos() && !isStandalonePwa()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR/CSR 불일치 방지를 위해 마운트 후에만 판정
      setNeedsInstall(true);
      return;
    }

    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
  }, []);

  async function handleSubscribe() {
    setError(null);
    setLoading(true);
    try {
      await subscribeToPush();
      setPermission("granted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림 설정에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (needsInstall) {
    return (
      <div className="card p-4 text-sm">
        <p className="font-semibold">📲 홈 화면에 추가해주세요</p>
        <p className="mt-1 text-neutral-500">
          iPhone에서는 홈 화면에 추가해야 푸시 알림을 받을 수 있어요. 하단 공유 버튼(
          <span className="font-mono">⬆️</span>) → &quot;홈 화면에 추가&quot;를 눌러주세요.
        </p>
      </div>
    );
  }

  if (permission === "granted" || permission === "unsupported") return null;

  return (
    <div className="card flex items-center justify-between gap-3 p-4 text-sm">
      <div>
        <p className="font-semibold">🔔 알림을 켜주세요</p>
        <p className="mt-1 text-neutral-500">알림을 켜야 친구가 보낸 푸시를 받을 수 있어요.</p>
        {error && <p className="mt-1 text-red-500">{error}</p>}
      </div>
      <button onClick={handleSubscribe} disabled={loading} className="btn-primary shrink-0">
        {loading ? "설정 중..." : "알림 켜기"}
      </button>
    </div>
  );
}
