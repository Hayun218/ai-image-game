"use client";

import { useEffect, useRef, useState } from "react";
import { GAME } from "@/config/event";
import type { FinishResponse } from "@/lib/api-types";

interface Props {
  finish: FinishResponse;
  onRestart: () => void;
  /** 입력 없이 60초가 지나면 호출 (시작 화면으로) */
  onIdle: () => void;
}

const RESTART_KEYS = new Set(["Enter", " ", "PageDown"]);

export function ResultScreen({ finish, onRestart, onIdle }: Props) {
  const [locked, setLocked] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 결과가 뜬 직후 잠깐은 입력을 무시 (앞 사람이 연타해서 바로 넘어가는 것 방지)
  useEffect(() => {
    const t = setTimeout(() => setLocked(false), GAME.resultInputLockMs);
    return () => clearTimeout(t);
  }, []);

  // 60초 동안 입력이 없으면 시작 화면으로
  useEffect(() => {
    const reset = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(onIdle, GAME.resultIdleMs);
    };
    reset();
    window.addEventListener("pointermove", reset);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener("pointermove", reset);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [onIdle]);

  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !RESTART_KEYS.has(e.key)) return;
      e.preventDefault();
      onRestart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onRestart]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-[3vh] text-center">
      {finish.passed ? <Pass finish={finish} /> : <Fail finish={finish} />}
      <button
        type="button"
        onClick={() => !locked && onRestart()}
        className={`mt-[2vh] rounded-full px-[6vh] py-[2.2vh] text-[4vh] font-black transition active:scale-95 ${
          locked ? "bg-white/15 text-white/50" : "bg-white text-black hover:brightness-90"
        }`}
      >
        다시하기 <span className="text-[2.6vh] font-bold opacity-70">Enter</span>
      </button>
    </div>
  );
}

function Pass({ finish }: { finish: FinishResponse }) {
  return (
    <>
      <Confetti />
      <p className="text-[4vh] font-bold text-white/85">
        {finish.total}문제 중 {finish.score}개 정답!
      </p>
      <h2 className="animate-pass bg-gradient-to-b from-white to-accent bg-clip-text text-[26vh] font-black leading-none tracking-tighter text-transparent drop-shadow-[0_0_5vh_rgba(228,0,127,0.55)]">
        PASS
      </h2>
      <p className="text-[3.4vh] font-bold">스태프에게 이 화면을 보여 주세요 🎁</p>
      <p className="rounded-[1vh] border-[0.3vh] border-white/40 px-[3vh] py-[1vh] font-mono text-[4.4vh] font-bold tracking-[0.3em]">
        #{finish.code}
      </p>
    </>
  );
}

function Fail({ finish }: { finish: FinishResponse }) {
  return (
    <>
      <p className="text-[4vh] font-bold text-white/70">아쉬워요!</p>
      <h2 className="text-[20vh] font-black leading-none tabular-nums">
        {finish.score}
        <span className="text-[10vh] text-white/50"> / {finish.total}</span>
      </h2>
      <p className="text-[3.6vh] font-bold">
        {GAME.passScore}개 이상 맞히면 <span className="text-accent">PASS</span> — 다시 도전해 보세요
      </p>
    </>
  );
}

const CONFETTI_COLORS = ["#e4007f", "#ffffff", "#22c55e", "#facc15", "#60a5fa"];

/** 가벼운 CSS 꽃가루 (값은 컴포넌트마다 한 번만 정한다) */
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 80 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.4 + Math.random() * 2,
      size: 0.8 + Math.random() * 1.2,
      rotate: Math.random() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-[-5vh] block"
          style={{
            left: `${p.left}%`,
            width: `${p.size}vh`,
            height: `${p.size * 1.8}vh`,
            background: p.color,
            rotate: `${p.rotate}deg`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
