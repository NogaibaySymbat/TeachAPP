import type { ReactNode } from "react";
import type { StudentPersonaState } from "@/lib/student-persona";

export function StudentPersona({ state, action }: { state: StudentPersonaState; action?: ReactNode }) {
  return <div className="chat-heading">
    <div className="chat-heading-main"><StudentAvatar expression={state.expression} activity={state.activity} />
      <div><h2 id="explanation-title" tabIndex={-1}>Milo <span className="milo-label">· AI student</span></h2><p role="status">{state.status}</p></div>
    </div>
    {action}
  </div>;
}

export function StudentAvatar({ expression, activity }: Pick<StudentPersonaState, "expression" | "activity">) {
  const focused = activity === "thinking" || activity === "writing" || activity === "exam";
  return <span className="milo-avatar" data-expression={expression} data-activity={activity} aria-hidden="true">
      <svg viewBox="0 0 56 56" fill="none">
        <path className="milo-page" d="M12 13h27a5 5 0 0 1 5 5v25H17a5 5 0 0 1-5-5V13Z" />
        <path d="M17 13v30M35 13v9l3-2 3 2v-9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        {focused ? <path d="m23 28 3-1m9 1-3-1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /> : <><circle cx="25" cy="28" r="1.7" fill="currentColor" /><circle cx="34" cy="28" r="1.7" fill="currentColor" /></>}
        <g className="milo-mouth" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path data-face="neutral" d="M26 35h7" />
          <path data-face="curious" d="M26 34q3.5 2 7 0" />
          <path data-face="learning" d="M26 34q3.5 5 7 0" />
          <path data-face="engaged" d="M25 33q4.5 8 9 0" />
          <path data-face="celebrating" d="M25 33q4.5 9 9 0Z" />
        </g>
      </svg>
    </span>;
}
