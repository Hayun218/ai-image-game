// 다크 / 라이트 모드. <html data-theme> 로 CSS 변수를 바꾸고 localStorage 에 기억한다.

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";
const STORAGE_KEY = "theme";

/** <head> 에서 첫 페인트 전에 실행: 저장된 테마를 적용해 깜빡임을 막는다 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장 못 해도 이번 화면에는 적용된다
  }
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
