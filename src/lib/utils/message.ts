/**
 * 단축버튼 메시지 템플릿을 렌더링한다.
 * - {{me}}   : 보내는 사람(발신자) 닉네임
 * - {{user}} : 받는 사람(수신자) 닉네임
 */
export function renderMessage(
  template: string,
  { senderNickname, recipientNickname }: { senderNickname: string; recipientNickname: string }
) {
  return template
    .replaceAll("{{me}}", senderNickname)
    .replaceAll("{{user}}", recipientNickname);
}

export const MAX_RECIPIENTS = 5;
export const DEFAULT_COOLDOWN_SECONDS = 30;
