import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * service_role 키를 사용하는 서버 전용 클라이언트. RLS를 무시하므로
 * 반드시 API route(서버) 내부에서만, 그리고 호출자의 권한을 직접
 * 검증한 뒤에만 사용한다. 클라이언트 컴포넌트에서 import 금지.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
