"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GAME, PREFETCH_MAX_AGE_MS } from "@/config/event";
import type { AnswerResponse, FinishResponse, Side } from "@/lib/api-types";
import { Header } from "./Header";
import { loadGame, post, type LoadedGame } from "./preload";
import { ResultScreen } from "./ResultScreen";
import { RoundView } from "./RoundView";
import { StartScreen } from "./StartScreen";

type Phase =
  | { name: "start" }
  | { name: "loading" }
  | { name: "round"; index: number; choice?: Side; answer?: AnswerResponse }
  | { name: "result"; finish: FinishResponse }
  | { name: "error"; message: string };

const LEFT_KEYS = new Set(["ArrowLeft", "PageUp"]);
const RIGHT_KEYS = new Set(["ArrowRight", "PageDown"]);
const GO_KEYS = new Set(["Enter", " ", "PageDown", "ArrowRight"]);

export function Game() {
  const [phase, setPhase] = useState<Phase>({ name: "start" });
  const [results, setResults] = useState<boolean[]>([]);
  const [game, setGame] = useState<LoadedGame | null>(null);
  const prefetchRef = useRef<{ promise: Promise<LoadedGame>; startedAt: number } | null>(null);
  const busyRef = useRef(false);

  /** 다음 게임을 백그라운드에서 미리 받아 둔다 (시작 화면 / 결과 화면에서 호출) */
  const prefetch = useCallback(() => {
    const cur = prefetchRef.current;
    if (cur && Date.now() - cur.startedAt < PREFETCH_MAX_AGE_MS) return;
    const promise = loadGame();
    const entry = { promise, startedAt: Date.now() };
    prefetchRef.current = entry;
    promise.catch(() => {
      if (prefetchRef.current === entry) prefetchRef.current = null;
    });
  }, []);

  const begin = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase({ name: "loading" });
    try {
      prefetch();
      const loaded = await prefetchRef.current!.promise;
      prefetchRef.current = null;
      setGame(loaded);
      setResults([]);
      setPhase({ name: "round", index: 0 });
    } catch (e) {
      setPhase({ name: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      busyRef.current = false;
    }
  }, [prefetch]);

  const choose = useCallback(
    async (side: Side) => {
      if (phase.name !== "round" || phase.choice || !game || busyRef.current) return;
      busyRef.current = true;
      const index = phase.index;
      setPhase({ name: "round", index, choice: side });
      try {
        const answer = await post<AnswerResponse>("/api/game/answer", {
          gameId: game.gameId,
          round: index,
          choice: side,
        });
        setResults((r) => [...r, answer.correct]);
        setPhase({ name: "round", index, choice: side, answer });

        const isLast = index === game.rounds.length - 1;
        // 마지막 라운드면 공개 화면이 보이는 동안 결과를 미리 받아 둔다
        const finishP = isLast ? post<FinishResponse>("/api/game/finish", { gameId: game.gameId }) : null;
        await new Promise((r) => setTimeout(r, GAME.revealMs));
        if (finishP) {
          setPhase({ name: "result", finish: await finishP });
        } else {
          setPhase({ name: "round", index: index + 1 });
        }
      } catch (e) {
        setPhase({ name: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        busyRef.current = false;
      }
    },
    [phase, game],
  );

  const goStart = useCallback(() => setPhase({ name: "start" }), []);

  // 시작 화면·결과 화면에 들어오면 다음 게임 미리 받기
  useEffect(() => {
    if (phase.name === "start" || phase.name === "result") prefetch();
  }, [phase.name, prefetch]);

  // 오류 화면은 잠시 뒤 자동으로 시작 화면으로
  useEffect(() => {
    if (phase.name !== "error") return;
    const t = setTimeout(() => setPhase({ name: "start" }), 10_000);
    return () => clearTimeout(t);
  }, [phase.name]);

  // 키보드 / 프레젠터 리모컨
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
        return;
      }
      if (e.repeat) return;
      if (phase.name === "round") {
        if (LEFT_KEYS.has(e.key)) choose("L");
        else if (RIGHT_KEYS.has(e.key)) choose("R");
        else return;
        e.preventDefault();
      } else if (phase.name === "start" || phase.name === "error") {
        if (GO_KEYS.has(e.key)) {
          e.preventDefault();
          begin();
        }
      }
      // 결과 화면의 키 입력은 ResultScreen 이 처리 (입력 잠금 시간 때문)
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.name, choose, begin]);

  const total = GAME.rounds;
  return (
    <main className="flex h-dvh w-dvw flex-col overflow-hidden">
      <Header
        progress={
          phase.name === "round"
            ? { current: phase.index + 1, total, results }
            : undefined
        }
      />
      <section className="relative flex min-h-0 flex-1 items-center justify-center">
        {phase.name === "start" && <StartScreen onStart={begin} />}
        {phase.name === "loading" && <Loading />}
        {phase.name === "round" && game && (
          <RoundView
            key={`${game.gameId}-${phase.index}`}
            round={game.rounds[phase.index]}
            choice={phase.choice}
            answer={phase.answer}
            onChoose={choose}
          />
        )}
        {phase.name === "result" && (
          <ResultScreen
            finish={phase.finish}
            onRestart={begin}
            onIdle={goStart}
          />
        )}
        {phase.name === "error" && <ErrorView message={phase.message} />}
      </section>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center gap-[3vh]">
      <div className="h-[8vh] w-[8vh] animate-spin rounded-full border-[0.8vh] border-white/15 border-t-accent" />
      <p className="text-[4vh] font-bold text-white/80">준비 중…</p>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex max-w-[70vw] flex-col items-center gap-[2vh] text-center">
      <p className="text-[4.5vh] font-bold">잠시 문제가 생겼어요</p>
      <p className="text-[2.4vh] text-white/60">{message}</p>
      <p className="text-[2.4vh] text-white/60">Enter 를 누르면 다시 시도합니다 · 10초 뒤 처음 화면으로</p>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
