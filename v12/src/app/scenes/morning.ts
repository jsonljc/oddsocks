import { roomById } from '../../core/house';
import { HOLLOW } from '../../house/hollow';
import { emptyBoard, findContradictions, placeClaim } from '../../log/board';
import { SIX_NIGHT_CLAIMS, SIX_NIGHT_MATCH } from '../../log/fixture';
import { projectForHouse } from '../../log/project';
import { renderReport } from '../../log/report';
import type { Claim } from '../../log/schema';

const PLAYER = 'bell';
const SUBJECTS = ['pike', 'clem', 'wren', 'sparrow', 'moss'];

/** One line of legible text per claim kind. The brief's own reference template
 *  checked only `'subject' in c` / `'room' in c` — found empirically (running
 *  `tsc`, then reading the actual rendered board) to silently drop real
 *  content for three of the five kinds: `player-player` has no `room` and no
 *  visible `object` (so "sparrow -> wren" loses who wren was placed WITH);
 *  `room-incident` has no `subject` and would show only "in attic", dropping
 *  the entire `incident` string (e.g. `c3`'s "a noise upstairs" — its only
 *  actual content); `deny` has neither, and would render as a bare
 *  "n4 · clem ->" indistinguishable from a malformed row. Since the acceptance
 *  criterion this task exists to check is precisely "is the board legible",
 *  a template that quietly blanks 3 of 5 claim kinds is in scope to fix, not
 *  a pre-existing gap to note and leave. Room ids are mapped to their display
 *  name (`roomById(...).name`, e.g. "Music Room" not "music_room") for the
 *  same reason the room-select buttons already show names, not ids. */
function describeClaim(c: Claim): string {
  const name = (id: string) => roomById(HOLLOW, id).name;
  switch (c.kind) {
    case 'player-room':   return `${c.subject} in the ${name(c.room)}`;
    case 'player-player': return `${c.subject} with ${c.object}`;
    case 'player-sock':   return `${c.subject} and ${c.sock}`;
    case 'room-incident': return `${name(c.room)}: ${c.incident}`;
    case 'deny':          return `denies ${c.denies}`;
    default:              return '';
  }
}

export function runMorningScene(root: HTMLElement, night: number): void {
  const board = emptyBoard();
  for (const c of SIX_NIGHT_CLAIMS.filter(c => c.night < night)) placeClaim(board, c);

  const style = document.createElement('style');
  style.textContent = `
    /* index.html's global stylesheet sets html,body { overflow: hidden } for
       slice 0's canvas-only assumption (the Pixi stage manages its own
       viewport, so the page itself was never meant to scroll). This scene has
       no canvas: two headings, up to 7 report lines, 5 subject buttons, 12
       room buttons (wrapping), a commit row, up to 9 claim rows and up to 3
       contradiction rows can genuinely exceed one screen's height. Verified
       empirically in a real browser window at night=6 (see the acceptance
       doc) — with the inherited overflow:hidden, content past the fold was
       not just unscrolled, it was UNREACHABLE, which would have made the
       exact thing criterion 2 asks a human to find sometimes physically
       impossible to scroll to. This rule is appended after index.html's own
       <style> tag (later in the cascade, equal selector specificity), so it
       wins for the life of this scene without editing index.html or
       affecting the night scene, which never runs this function. */
    html, body { overflow: auto; }
    .morning { font: 16px/1.6 Georgia, serif; color: #e8dcc8; padding: 32px;
               max-width: 900px; margin: 0 auto; }
    .morning h2 { font-weight: normal; letter-spacing: .08em; color: #b9a88f; }
    .report { border-left: 3px solid #6b5a3e; padding-left: 16px; margin: 24px 0; }
    .claim-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .claim-row button { font: inherit; background: #2a2434; color: #e8dcc8;
                        border: 1px solid #4a3f57; padding: 6px 12px; cursor: pointer; }
    .claim-row button[aria-pressed="true"] { background: #6b5a3e; }
    .placed { margin: 4px 0; color: #cbbfa8; }
    .contradiction { color: #e0a0a0; border-left: 3px solid #e0a0a0; padding-left: 12px; }
    .timer { color: #b9a88f; font-variant-numeric: tabular-nums; }
  `;
  document.head.appendChild(style);

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'morning';
  root.appendChild(wrap);

  let subject: string | null = null;
  let room: string | null = null;
  const started = performance.now();

  function render(): void {
    const report = renderReport(projectForHouse(SIX_NIGHT_MATCH, night), HOLLOW);
    const contradictions = findContradictions(board);
    wrap.innerHTML = `
      <h2>Night ${night}</h2>
      <div class="report">${report.map(l => `<div>${l}</div>`).join('')}</div>
      <h2>The claim board</h2>
      <div class="claim-row" id="subjects">${SUBJECTS.map(s =>
        `<button data-subject="${s}" aria-pressed="${subject === s}">${s}</button>`).join('')}</div>
      <div class="claim-row" id="rooms">${HOLLOW.rooms.map(r =>
        `<button data-room="${r.id}" aria-pressed="${room === r.id}">${r.name}</button>`).join('')}</div>
      <div class="claim-row"><button id="commit">Commit claim</button>
        <span class="timer" id="timer"></span></div>
      ${board.claims.map(c => `<div class="placed">n${c.night} · ${c.by} → ${describeClaim(c)}</div>`).join('')}
      ${contradictions.map(c => `<div class="contradiction">${c.because}</div>`).join('')}
    `;

    wrap.querySelectorAll<HTMLButtonElement>('[data-subject]').forEach(b =>
      b.onclick = () => { subject = b.dataset.subject!; render(); });
    wrap.querySelectorAll<HTMLButtonElement>('[data-room]').forEach(b =>
      b.onclick = () => { room = b.dataset.room!; render(); });
    wrap.querySelector<HTMLButtonElement>('#commit')!.onclick = () => {
      if (!subject || !room) return;
      // `id` is not in the brief's given literal — `tsc --noEmit` catches it
      // immediately (`ClaimBase` requires `id: ClaimId`; see the report's TDD
      // evidence for the exact captured error). `${by}-n${night}` matches the
      // convention `test/board.test.ts`'s own `roomClaim` helper uses, and
      // cannot collide with a fixture id (`SIX_NIGHT_CLAIMS` uses bare 'c1'..
      // 'c9', never this pattern) or with a second commit this session
      // (`placeClaim`'s one-mark-per-morning check refuses the second attempt
      // before id-uniqueness is ever reached, so the same id is never pushed
      // twice — see board.ts's own docstring on check ordering).
      const claim: Claim = { id: `${PLAYER}-n${night}`, kind: 'player-room', night, by: PLAYER, subject, room };
      const r = placeClaim(board, claim);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      // The number slice 1 is actually for: how long one claim took to place.
      console.log(`[claim] ${r.ok ? 'placed' : `refused: ${r.reason}`} after ${secs}s`);
      subject = null; room = null;
      render();
    };
    const t = wrap.querySelector<HTMLElement>('#timer')!;
    t.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s of 60`;
  }

  render();
  setInterval(() => {
    const t = wrap.querySelector<HTMLElement>('#timer');
    if (t) t.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s of 60`;
  }, 100);
}
