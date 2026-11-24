"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { AnswerResponse, Credit, Side } from "@/lib/api-types";
import type { LoadedRound } from "./preload";

interface Props {
  round: LoadedRound;
  choice?: Side;
  answer?: AnswerResponse;
  onChoose: (side: Side) => void;
}

/**
 * 두 장은 이미 디코드된 <img> 요소를 그대로 DOM 에 붙이고,
 * 하나의 래퍼에 opacity 전환을 걸어 같은 프레임에 함께 나타나게 한다.
 */
export function RoundView({ round, choice, answer, onChoose }: Props) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    leftRef.current?.replaceChildren(round.left);
    rightRef.current?.replaceChildren(round.right);
    // 붙인 다음 프레임에 한 번에 보이게
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [round]);

  return (
    <div
      className={`flex items-center justify-center gap-[2vw] portrait:flex-col portrait:gap-[calc(var(--u)*5)] transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <Slot side="L" slotRef={leftRef} choice={choice} answer={answer} onChoose={onChoose} />
      <Slot side="R" slotRef={rightRef} choice={choice} answer={answer} onChoose={onChoose} />
    </div>
  );
}

function Slot({
  side,
  slotRef,
  choice,
  answer,
  onChoose,
}: {
  side: Side;
  slotRef: React.RefObject<HTMLDivElement | null>;
  choice?: Side;
  answer?: AnswerResponse;
  onChoose: (side: Side) => void;
}) {
  const chosen = choice === side;
  const isAi = answer?.aiSide === side;
  const credit = answer ? (side === "L" ? answer.credit.left : answer.credit.right) : null;

  let ring = "ring-transparent";
  if (answer && chosen) ring = answer.correct ? "ring-ok" : "ring-bad";
  else if (answer && isAi) ring = "ring-ok/70"; // 틀렸을 때 실제 AI 쪽을 보여 준다
  else if (chosen) ring = "ring-foreground";

  return (
    <div
      role="button"
      aria-disabled={!!choice}
      onClick={() => !choice && onChoose(side)}
      className={`relative size-(--sq) overflow-hidden rounded-[calc(var(--u)*1.2)] bg-foreground/5 ring-[length:calc(var(--u)*1)] ${ring} ${
        choice ? "cursor-default" : "cursor-pointer"
      }`}
      aria-label={side === "L" ? "왼쪽 사진" : "오른쪽 사진"}
    >
      <div ref={slotRef} className="h-full w-full" />

      {!choice && (
        <span className="pointer-events-none absolute bottom-[calc(var(--u)*2)] left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-[calc(var(--u)*2)] py-[calc(var(--u)*0.6)] text-[length:calc(var(--u)*2.6)] font-bold text-white/85">
          <span className="portrait:hidden">{side === "L" ? "← 왼쪽" : "오른쪽 →"}</span>
          <span className="hidden portrait:inline">{side === "L" ? "↑ 위" : "아래 ↓"}</span>
        </span>
      )}

      {answer && (
        <>
          <span
            className={`absolute left-1/2 top-[calc(var(--u)*2.5)] -translate-x-1/2 rounded-full px-[calc(var(--u)*2.6)] py-[calc(var(--u)*0.8)] text-[length:calc(var(--u)*4.2)] font-black shadow-lg ${
              isAi ? "bg-accent text-white" : "bg-white text-black"
            }`}
          >
            {isAi ? "AI" : "사람이 촬영"}
          </span>
          {chosen && (
            <span
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--u)*2)] bg-black/65 px-[calc(var(--u)*4)] py-[calc(var(--u)*1.2)] text-[length:calc(var(--u)*9)] font-black leading-none ${
                answer.correct ? "text-ok" : "text-bad"
              }`}
            >
              {answer.correct ? "정답!" : "오답"}
            </span>
          )}
          {credit && <CreditLine credit={credit} isAi={isAi} />}
        </>
      )}
    </div>
  );
}

function CreditLine({ credit, isAi }: { credit: Credit; isAi: boolean }) {
  return (
    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-[calc(var(--u)*2)] pb-[calc(var(--u)*1.4)] pt-[calc(var(--u)*4)] text-left text-[length:calc(var(--u)*1.8)] text-white/85">
      {isAi ? "Image" : "Photo"} by{" "}
      {credit.link ? (
        <a
          href={credit.link}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          {credit.name}
        </a>
      ) : (
        // 직접 생성한 AI 이미지는 원본 페이지가 없다
        credit.name
      )}
      {credit.source ? ` on ${credit.source}` : ""}
      {credit.license ? ` · ${credit.license}` : ""}
    </span>
  );
}
