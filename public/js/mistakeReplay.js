// Mistake Replay — drilling the mistakes you actually made, until they stop being mistakes.
//
// The mistake book only ever grew: entries went in and the only way out was deleting them by
// hand, which meant the pattern signal never decayed no matter how much work the student put
// in. Replay closes that loop. It shows the real saved question with the answer hidden, and
// two correct attempts in a row retire it from the active book.
//
// Two, not one — answering correctly straight after reading the answer proves short-term
// recall, not that the gap is closed. And retiring never deletes: resolved entries stay in
// storage as the record of what got fixed, and can be put back in rotation.
import {
  getActiveMistakes,
  getResolvedMistakes,
  markReplay,
  unresolveMistake,
  deleteMistake,
  REPLAY_STREAK_TO_RESOLVE,
} from "./mistakeBookStore.js";
import { logEvent } from "./progress.js";
import { confirmDanger } from "./modal.js";
import { showToast } from "./toast.js";
import { invalidateBrain } from "./secondBrain.js";

let session = null;
let onChanged = null;
// Set when another view deep-links into replay for a specific topic.
let pendingTopic = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function requestReplay(topic) {
  pendingTopic = topic || null;
}

export function consumeRequestedTopic() {
  const t = pendingTopic;
  pendingTopic = null;
  return t;
}

function startSession(topic) {
  const pool = getActiveMistakes().filter((m) => !topic || (m.topic || "General") === topic);
  if (pool.length === 0) return false;
  session = { topic: topic || null, queue: pool.map((m) => m.id), index: 0, revealed: false, right: 0, wrong: 0 };
  return true;
}

function endSession() {
  session = null;
}

// ---------------------------------------------------------------------------

function renderDrill(wrap) {
  const all = getActiveMistakes();
  const current = all.find((m) => m.id === session.queue[session.index]);

  // The entry could have been resolved or removed since the queue was built.
  if (!current) {
    session.index += 1;
    if (session.index >= session.queue.length) return renderSummary(wrap);
    return renderDrill(wrap);
  }

  const head = el("div", "replay-head");
  head.appendChild(el("span", "replay-progress", `${session.index + 1} of ${session.queue.length}`));
  const streak = Number(current.replayStreak) || 0;
  head.appendChild(
    el(
      "span",
      "replay-streak",
      streak > 0
        ? `${streak} of ${REPLAY_STREAK_TO_RESOLVE} correct in a row — one more retires it`
        : `Needs ${REPLAY_STREAK_TO_RESOLVE} in a row to retire`
    )
  );
  wrap.appendChild(head);

  const card = el("div", "replay-card");
  if (current.topic) card.appendChild(el("span", "replay-topic", current.topic));
  card.appendChild(el("p", "replay-question", current.question));

  if (!session.revealed) {
    card.appendChild(el("p", "replay-hint", "Answer it in your head — or out loud — before revealing."));
    const reveal = el("button", "btn btn-primary", "Reveal the answer");
    reveal.type = "button";
    reveal.addEventListener("click", () => {
      session.revealed = true;
      render(wrap.parentElement);
    });
    const actions = el("div", "replay-actions");
    actions.appendChild(reveal);
    card.appendChild(actions);
  } else {
    const answer = el("div", "replay-answer");
    const yours = el("p", null);
    yours.appendChild(el("strong", null, "You said: "));
    yours.appendChild(el("span", null, current.studentAnswer || "—"));
    const right = el("p", null);
    right.appendChild(el("strong", null, "Correct: "));
    right.appendChild(el("span", null, current.correctAnswer || "—"));
    answer.appendChild(yours);
    answer.appendChild(right);
    if (current.explanation) answer.appendChild(el("p", "replay-explanation", current.explanation));
    card.appendChild(answer);

    const grade = el("div", "replay-grade");
    grade.appendChild(el("span", "replay-grade-label", "Did you get it this time?"));
    const gotIt = el("button", "btn btn-primary", "I got it");
    gotIt.type = "button";
    gotIt.addEventListener("click", () => grade_(wrap, current, true));
    const missed = el("button", "btn btn-ghost", "Still missed it");
    missed.type = "button";
    missed.addEventListener("click", () => grade_(wrap, current, false));
    grade.appendChild(gotIt);
    grade.appendChild(missed);
    card.appendChild(grade);
  }

  wrap.appendChild(card);

  const foot = el("div", "replay-foot");
  const skip = el("button", "btn btn-ghost brain-btn-sm", "Skip");
  skip.type = "button";
  skip.addEventListener("click", () => advance(wrap));
  const stop = el("button", "btn btn-ghost brain-btn-sm", "Stop replay");
  stop.type = "button";
  stop.addEventListener("click", () => {
    endSession();
    if (onChanged) onChanged();
  });
  foot.appendChild(skip);
  foot.appendChild(stop);
  wrap.appendChild(foot);
}

function grade_(wrap, mistake, correct) {
  const updated = markReplay(mistake.id, correct);
  // Self-graded, like the short-answer path in a quiz — it's the student's own judgement,
  // and it's logged as a real answered question either way.
  logEvent("question", { source: "mistake_replay", correct, subject: mistake.subject, topic: mistake.topic });
  invalidateBrain();
  if (correct) {
    session.right += 1;
    if (updated && updated.resolvedAt) {
      showToast(`Retired from your mistake book — ${REPLAY_STREAK_TO_RESOLVE} in a row.`, "success", 2800);
    }
  } else {
    session.wrong += 1;
  }
  advance(wrap);
}

function advance(wrap) {
  session.revealed = false;
  session.index += 1;
  if (onChanged) onChanged();
  else render(wrap.parentElement);
}

function renderSummary(wrap) {
  wrap.appendChild(el("h4", "replay-summary-title", "Replay finished"));
  const done = session.right + session.wrong;
  wrap.appendChild(
    el(
      "p",
      "replay-summary-line",
      done === 0
        ? "You skipped every one — nothing was recorded."
        : `${session.right} of ${done} answered correctly this time round. Anything you got right twice in a row has retired from the book; anything you missed went back to the start.`
    )
  );
  const again = el("button", "btn btn-primary", "Back to the book");
  again.type = "button";
  again.addEventListener("click", () => {
    endSession();
    if (onChanged) onChanged();
  });
  const row = el("div", "replay-actions");
  row.appendChild(again);
  wrap.appendChild(row);
}

// ---------------------------------------------------------------------------

function renderBook(wrap) {
  const active = getActiveMistakes();
  const resolved = getResolvedMistakes();

  const byTopic = {};
  active.forEach((m) => {
    const key = m.topic || "General";
    byTopic[key] = (byTopic[key] || 0) + 1;
  });
  const topics = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);

  if (active.length === 0) {
    wrap.appendChild(
      el(
        "p",
        "brain-empty-line",
        resolved.length > 0
          ? `Nothing left to drill — all ${resolved.length} mistake${resolved.length === 1 ? "" : "s"} you've saved ${resolved.length === 1 ? "has" : "have"} been answered correctly twice in a row. They're kept below as a record.`
          : "No mistakes saved yet. When you get something wrong in a quiz or a Boss Battle, it lands here so you can drill it later."
      )
    );
  } else {
    const bar = el("div", "replay-bar");
    const startAll = el("button", "btn btn-primary", `Replay all ${active.length}`);
    startAll.type = "button";
    startAll.addEventListener("click", () => {
      startSession(null);
      if (onChanged) onChanged();
    });
    bar.appendChild(startAll);
    topics.forEach(([topic, count]) => {
      const btn = el("button", "btn btn-ghost brain-btn-sm", `${topic} (${count})`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        startSession(topic);
        if (onChanged) onChanged();
      });
      bar.appendChild(btn);
    });
    wrap.appendChild(bar);

    const list = el("div", "replay-list");
    active.slice(0, 12).forEach((m) => {
      const row = el("div", "replay-row");
      const main = el("div", "replay-row-main");
      main.appendChild(el("p", "replay-row-q", m.question));
      const meta = [];
      if (m.topic) meta.push(m.topic);
      const streak = Number(m.replayStreak) || 0;
      if (streak > 0) meta.push(`${streak}/${REPLAY_STREAK_TO_RESOLVE} correct in a row`);
      const attempts = Number(m.replayAttempts) || 0;
      if (attempts > 0) meta.push(`${attempts} replay${attempts === 1 ? "" : "s"}`);
      main.appendChild(el("p", "replay-row-meta", meta.join(" · ")));
      row.appendChild(main);

      const del = el("button", "icon-btn-sm", "Remove");
      del.type = "button";
      del.addEventListener("click", () => {
        confirmDanger("Remove this mistake?", "It'll be gone from your mistake book for good.", "Remove", () => {
          deleteMistake(m.id);
          invalidateBrain();
          if (onChanged) onChanged();
        });
      });
      row.appendChild(del);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    if (active.length > 12) {
      wrap.appendChild(el("p", "replay-more", `+${active.length - 12} more in the replay queue.`));
    }
  }

  if (resolved.length > 0) {
    const details = document.createElement("details");
    details.className = "replay-resolved";
    const summary = document.createElement("summary");
    summary.textContent = `Retired (${resolved.length})`;
    details.appendChild(summary);
    details.appendChild(
      el("p", "replay-row-meta", "Answered correctly twice in a row. Kept as a record — put one back if it turns out it wasn't really fixed.")
    );
    resolved.slice(0, 20).forEach((m) => {
      const row = el("div", "replay-row");
      const main = el("div", "replay-row-main");
      main.appendChild(el("p", "replay-row-q", m.question));
      main.appendChild(el("p", "replay-row-meta", m.topic || "General"));
      row.appendChild(main);
      const back = el("button", "icon-btn-sm", "Put back");
      back.type = "button";
      back.addEventListener("click", () => {
        unresolveMistake(m.id);
        invalidateBrain();
        if (onChanged) onChanged();
      });
      row.appendChild(back);
      details.appendChild(row);
    });
    wrap.appendChild(details);
  }
}

// `container` is the card this owns. `refresh` is called whenever state changes so the host
// view can re-render the whole card (and anything else that depends on the mistake counts).
export function render(container, refresh) {
  if (!container) return;
  if (refresh) onChanged = refresh;
  container.innerHTML = "";

  const wrap = el("div", "replay-wrap");
  container.appendChild(wrap);

  if (session) {
    if (session.index >= session.queue.length) renderSummary(wrap);
    else renderDrill(wrap);
    return;
  }
  renderBook(wrap);
}

export function startReplayForTopic(topic) {
  const started = startSession(topic);
  if (!started) startSession(null);
  return started;
}

export function hasActiveSession() {
  return Boolean(session);
}
