"use client";

import type { ShortcutListItem } from "@/types/app";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  shortcut: ShortcutListItem;
  onSend: () => void;
  onEdit: () => void;
}

export default function ShortcutCard({ shortcut, onSend, onEdit }: Props) {
  return (
    <div className="card relative w-full p-4 text-left">
      <button
        onClick={onEdit}
        aria-label="설정"
        className="absolute right-3 top-3 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100"
      >
        ⚙️
      </button>

      <button onClick={onSend} className="flex w-full flex-col items-start gap-1 pr-8 text-left">
        <span className="text-base font-bold">{shortcut.name}</span>
        <span className="line-clamp-2 text-sm text-neutral-500">{shortcut.messageTemplate}</span>
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
          <span>{formatDate(shortcut.createdAt)} 추가</span>
          {shortcut.defaultRecipients.length > 0 && (
            <>
              <span>·</span>
              <span>기본 상대 {shortcut.defaultRecipients.length}명</span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}
