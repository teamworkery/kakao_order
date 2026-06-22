import { cn } from "~/lib/utils";

/**
 * pojang.one 브랜드 마크 (소문자 'p.' 워드마크형).
 * currentColor 를 쓰므로 부모에서 text-primary 등으로 색을 지정한다.
 * 크기는 className 의 size-* (w/h) 로 제어.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      role="img"
      aria-label="pojang.one"
    >
      <rect x="12" y="12" width="5" height="30" rx="2.5" fill="currentColor" />
      <circle cx="24.5" cy="22.5" r="8.5" fill="none" stroke="currentColor" strokeWidth="5" />
      <circle cx="36" cy="30" r="3" fill="currentColor" />
    </svg>
  );
}

interface BrandLogoProps {
  /** 래퍼 클래스 */
  className?: string;
  /** 마크 크기/색 (기본 size-7 text-primary) */
  markClassName?: string;
  /** 워드마크 텍스트 표시 여부 (기본 true) */
  showWordmark?: boolean;
  /** 워드마크 텍스트 크기 클래스 (기본 text-[16px]) */
  wordmarkClassName?: string;
}

/**
 * 마크 + 'pojang.one' 워드마크 묶음. 헤더/푸터/인증 페이지 공용.
 */
export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark className={cn("text-primary", markClassName ?? "size-7")} />
      {showWordmark && (
        <span
          className={cn(
            "font-extrabold tracking-tight leading-none",
            wordmarkClassName ?? "text-[16px]"
          )}
        >
          pojang<span className="text-primary">.one</span>
        </span>
      )}
    </span>
  );
}
