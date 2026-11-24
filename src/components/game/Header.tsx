import { EVENT } from "@/config/event";
import { toggleTheme } from "../theme";

interface Props {
  progress?: { current: number; total: number; results: boolean[] };
}

/** 상단 고정 바: 행사명 + (라운드 중) 질문과 진행 상황. 두 모드 모두 남색 바에 흰 글자 */
export function Header({ progress }: Props) {
  return (
    <header className="relative flex h-[calc(var(--u)*9)] shrink-0 items-center justify-between bg-gradient-to-r from-navy to-navy/40 px-[2.5vw] text-white light:to-navy/85">
      <div className="flex flex-col justify-center leading-tight">
        <span className="text-[length:calc(var(--u)*1.6)] font-bold tracking-[0.25em] text-accent light:text-[#ff5cb3]">{EVENT.tagline}</span>
        <span className="text-[length:calc(var(--u)*2.8)] font-extrabold tracking-tight">{EVENT.name}</span>
      </div>

      {progress && (
        <p className="absolute left-1/2 -translate-x-1/2 text-[length:calc(var(--u)*4.2)] font-black tracking-tight">
          AI가 만든 사진은?
        </p>
      )}

      <div className="flex items-center gap-[calc(var(--u)*2)]">
        {progress && (
          <div className="flex items-center gap-[calc(var(--u)*1.2)]" aria-label={`${progress.current} / ${progress.total} 라운드`}>
            {Array.from({ length: progress.total }, (_, i) => {
              const r = progress.results[i];
              const cls =
                r === true
                  ? "bg-ok border-ok"
                  : r === false
                    ? "bg-bad border-bad"
                    : i === progress.current - 1
                      ? "border-white bg-white/20"
                      : "border-white/35";
              return <span key={i} className={`h-[calc(var(--u)*2.2)] w-[calc(var(--u)*2.2)] rounded-full border-[length:calc(var(--u)*0.35)] ${cls}`} />;
            })}
            <span className="ml-[calc(var(--u)*1)] text-[length:calc(var(--u)*3)] font-bold tabular-nums">
              {progress.current} / {progress.total}
            </span>
          </div>
        )}
        <ThemeButton />
      </div>
    </header>
  );
}

/** 다크/라이트 전환 (T 키와 같음). 포커스를 받지 않아 Enter 가 이 버튼을 누르지 않는다 */
function ThemeButton() {
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => toggleTheme()}
      title="다크/라이트 전환 (T)"
      aria-label="다크/라이트 전환"
      className="flex h-[calc(var(--u)*4.4)] w-[calc(var(--u)*4.4)] items-center justify-center rounded-full bg-white/10 text-[length:calc(var(--u)*2.4)] text-white/80 transition hover:bg-white/20"
    >
      <span className="light:hidden">☀</span>
      <span className="hidden light:inline">☾</span>
    </button>
  );
}
