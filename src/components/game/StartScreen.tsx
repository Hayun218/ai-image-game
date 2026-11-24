import { GAME } from "@/config/event";

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-[calc(var(--u)*4)] text-center">
      <h1 className="text-[length:calc(var(--u)*13)] font-black leading-none tracking-tight">
        <span className="text-accent">AI</span> or Human?
      </h1>
      <p className="text-[length:calc(var(--u)*4.4)] font-bold">두 사진 중 AI가 만든 사진을 고르세요</p>
      <p className="text-[length:calc(var(--u)*3.4)] text-foreground/75">
        {GAME.rounds}문제 중 <b className="text-foreground">{GAME.passScore}개 이상</b> 맞히면 <b className="text-accent">PASS</b> · 상품 증정
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-[calc(var(--u)*2)] rounded-full bg-accent text-white px-[calc(var(--u)*6)] py-[calc(var(--u)*2.2)] text-[length:calc(var(--u)*4)] font-black shadow-[0_0_calc(var(--u)*6)_rgba(228,0,127,0.45)] transition hover:brightness-110 active:scale-95"
      >
        시작하기 <span className="text-[length:calc(var(--u)*2.6)] font-bold opacity-80">Enter</span>
      </button>
      <p className="text-[length:calc(var(--u)*2.4)] text-foreground/50">← → 키 또는 클릭으로 선택 · F 전체화면 · T 다크/라이트</p>
    </div>
  );
}
