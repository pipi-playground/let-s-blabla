# 렛블블

문자 보내기 귀찮을 때, 미리 만들어둔 단축버튼 하나로 상대에게 푸시알림을 보내는 PWA 웹앱.

- **Next.js** (App Router, API Routes) — 프론트/백엔드 겸용
- **Supabase** — Auth, Postgres, RLS
- **Web Push** — PWA + Service Worker 기반 푸시 알림
- **Vercel** — 배포

## 시작하기

### 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. `supabase/migrations/0001_init.sql` 내용을 SQL Editor에 그대로 붙여넣고 실행
   - profiles(닉네임/회원코드), friends, shortcuts, shortcut_recipients, push_subscriptions, mutes, dnd_settings, send_logs 테이블과 RLS 정책이 생성됩니다.
3. **Authentication → Providers → Email**에서 **"Confirm email"을 꺼주세요.** (이메일 인증 없이 가입 즉시 로그인되도록 하기 위함)
4. **Project Settings → API**에서 `Project URL`, `anon public` 키, `service_role` 키를 복사

### 2. 환경 변수 설정

`.env.local` (로컬 개발용, 커밋되지 않음)에 아래 값을 채워주세요:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

VAPID 키(웹푸시용)는 이미 개발용 키가 채워져 있습니다. 실제 운영 시에는 아래 명령으로 새로 발급받아 교체하는 걸 권장합니다:

```bash
npx web-push generate-vapid-keys
```

### 3. 로컬 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속. 웹푸시는 `localhost`에서도 동작하지만, 실제 배포 도메인(HTTPS)에서 최종 확인하는 걸 권장합니다.

### 4. Vercel 배포

1. GitHub에 push 후 Vercel에서 이 저장소 import
2. Vercel 프로젝트 설정 → Environment Variables에 위 6개 값(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) 등록
3. Deploy

## PWA 설치 (푸시 알림을 받으려면 필수)

- **iPhone (Safari)**: 홈 화면에 추가해야만 푸시가 옵니다. 공유 버튼 → "홈 화면에 추가" → 홈 화면 아이콘으로 실행 → 로그인 후 "알림 켜기" 버튼 탭
- **Android / 데스크톱 (Chrome)**: 웹앱 접속 후 바로 "알림 켜기" 버튼 탭 (홈 화면 추가는 선택 사항)

## 주요 기능

- 이메일/비밀번호 회원가입, 가입과 동시에 4자리 회원코드 발급 (비밀번호 재설정 없음)
- 단축버튼 추가/수정/삭제 (이름·메시지 필수, 기본 전송 대상 최대 5명 선택)
- 메시지에 `{{me}}`(보내는 사람 닉네임), `{{user}}`(받는 사람 닉네임) 치환 지원 + 작성 중 실시간 미리보기
- 회원코드로 친구 추가
- 단축버튼 클릭 → 친구 팝업(기본 대상 사전 선택, 최대 5명, 해제 가능) → 전송
- 버튼당 30초 발송 쿨다운
- 상대별 알림 끄기(뮤트), 방해금지 시간대 설정

## 프로젝트 구조

```
supabase/migrations/0001_init.sql   DB 스키마 + RLS
src/middleware.ts → src/proxy.ts    인증 라우트 보호 (Next.js 16 proxy 컨벤션)
src/lib/supabase/{client,server,admin}.ts   Supabase 클라이언트 (브라우저/서버/서비스롤)
src/lib/push/webpush.ts             웹푸시 발송
src/lib/utils/{message,dnd,push-client}.ts  메시지 템플릿, 방해금지 판정, 구독 유틸
src/app/login                       회원가입/로그인
src/app/(main)                      홈 / 친구 / 설정 (공통 상단 네비게이션)
src/app/api/**                      REST API Route Handlers
public/manifest.json, public/sw.js  PWA 매니페스트 & 서비스워커
```

## 알려진 제약 / 다음에 고려할 것

- 회원코드가 4자리 숫자라 전수조사로 다른 사람 코드를 알아낼 수 있습니다. 지인 소규모 사용을 전제로 한 트레이드오프입니다.
- 발송 결과(성공/뮤트/방해금지/실패/미구독)는 보내는 화면에서만 확인 가능하고, 별도의 인앱 알림함은 없습니다.
- 아이콘은 자리표시용 단색 PNG입니다. `public/icons/`, `public/favicon-32.png`를 원하는 디자인으로 교체하세요.
