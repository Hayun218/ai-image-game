import { EVENT } from "@/config/event";

interface Props {
  progress?: { current: number; total: number; results: boolean[] };
}

/** 상단 고정 바: 행사명 + (라운드 중) 질문과 진행 상황 */
export function Header({ progress }: Props) {
  return (
    <header className="relative flex h-[9vh] shrink-0 items-center justify-between bg-gradient-to-r from-navy to-navy/40 px-[2.5vw]">
      <div className="flex flex-col justify-center leading-tight">
        <span className="text-[1.6vh] font-bold tracking-[0.25em] text-accent">{EVENT.tagline}</span>
        <span className="text-[2.8vh] font-extrabold tracking-tight">{EVENT.name}</span>
      </div>

      {progress && (
        <p className="absolute left-1/2 -translate-x-1/2 text-[4.2vh] font-black tracking-tight">
          AI가 만든 사진은?
        </p>
      )}

      {progress && (
        <div className="flex items-center gap-[1.2vh]" aria-label={`${progress.current} / ${progress.total} 라운드`}>
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
            return <span key={i} className={`h-[2.2vh] w-[2.2vh] rounded-full border-[0.35vh] ${cls}`} />;
          })}
          <span className="ml-[1vh] text-[3vh] font-bold tabular-nums">
            {progress.current} / {progress.total}
          </span>
        </div>
      )}
    </header>
  );
}
