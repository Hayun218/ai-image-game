import { GAME } from "@/config/event";

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-[4vh] text-center">
      <h1 className="text-[13vh] font-black leading-none tracking-tight">
        <span className="text-accent">AI</span> or Human?
      </h1>
      <p className="text-[4.4vh] font-bold">두 사진 중 AI가 만든 사진을 고르세요</p>
      <p className="text-[3.4vh] text-foreground/75">
        {GAME.rounds}문제 중 <b className="text-foreground">{GAME.passScore}개 이상</b> 맞히면 <b className="text-accent">PASS</b> · 상품 증정
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-[2vh] rounded-full bg-accent text-white px-[6vh] py-[2.2vh] text-[4vh] font-black shadow-[0_0_6vh_rgba(228,0,127,0.45)] transition hover:brightness-110 active:scale-95"
      >
        시작하기 <span className="text-[2.6vh] font-bold opacity-80">Enter</span>
      </button>
      <p className="text-[2.4vh] text-foreground/50">← → 키 또는 클릭으로 선택 · F 전체화면 · T 다크/라이트</p>
    </div>
  );
}
