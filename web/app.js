/* UI: one question per screen, then results. Answers stay in memory only. */
(function () {
  const KB = window.KB;
  const Engine = window.Engine;
  const app = document.getElementById("app");

  document.getElementById("kb-date").textContent = KB.updated;
  document.getElementById("kb-link").href = KB.SOURCE_URL;

  let answers = {};
  let history = []; // ids of answered questions, in order, for "Back"

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function render(html, focusSel) {
    app.innerHTML = html;
    const el = focusSel && app.querySelector(focusSel);
    if (el) el.focus();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ intro
  function showIntro() {
    answers = {};
    history = [];
    render(`
      <div class="card">
        <h1>Check symptoms against cancer referral guidelines</h1>
        <p>You'll answer simple questions one at a time, grouped by body area. Follow-up questions only appear when they're relevant.
        At the end you'll see which cancers, if any, UK doctors' guidelines link your answers to, and how soon to see a doctor.</p>
        <p><strong>This is not a diagnosis.</strong> Almost every symptom here is usually caused by something other than cancer.
        The guidelines flag symptoms where the chance of cancer is around 3% or more, to make sure it gets checked.
        A "no match" result doesn't rule cancer out either.</p>
        <h3>How to answer</h3>
        <ul class="plain">
          <li><strong>Unexplained</strong> means there's no obvious cause, like a cold, an injury or a known condition.</li>
          <li><strong>Persistent</strong> means it has lasted 3 weeks or more, or keeps coming back.</li>
          <li>If you're not sure, answer <em>yes</em>. It's better to mention something to a doctor than leave it out.</li>
        </ul>
        <div class="notice">
          <strong>If you feel seriously unwell right now</strong>, for example with heavy bleeding, chest pain, severe breathlessness
          or sudden weakness on one side, call emergency services instead of using this tool.
        </div>
        <p class="muted">Everything stays on your computer. Answers are not saved, and nothing is sent anywhere.</p>
        <div class="actions"><button class="btn primary" id="start">Start the checklist</button></div>
      </div>`, "#start");
    app.querySelector("#start").onclick = showNext;
  }

  // -------------------------------------------------------------- questions
  function showNext() {
    const q = Engine.nextQuestion(KB, answers);
    if (!q) return showResults();
    showQuestion(q);
  }

  function showQuestion(q) {
    const visible = Engine.visibleQuestions(KB, answers);
    const pos = visible.findIndex((v) => v.id === q.id) + 1;
    const pct = Math.round(((pos - 1) / visible.length) * 100);
    const prev = answers[q.id];

    let body = "";
    if (q.type === "yesno") {
      body = `<div class="answers">
          <button class="btn ${prev === true ? "selected" : ""}" data-v="yes">Yes</button>
          <button class="btn ${prev === false ? "selected" : ""}" data-v="no">No</button>
        </div>
        <div class="kbd-hint">Keyboard: <kbd>Y</kbd> yes · <kbd>N</kbd> no · <kbd>Backspace</kbd> back</div>`;
    } else if (q.type === "choice") {
      body = `<div class="answers choices">${q.options
        .map((o) => `<button class="btn ${prev === o.value ? "selected" : ""}" data-v="${esc(o.value)}">${esc(o.label)}</button>`)
        .join("")}</div>`;
    } else if (q.type === "number") {
      body = `<form class="num-row" id="numform">
          <input id="num" type="number" inputmode="numeric" min="${q.min}" max="${q.max}" value="${prev ?? ""}" aria-label="${esc(q.text)}" required />
          <button class="btn primary" type="submit">Next</button>
        </form>
        <div class="error" id="err"></div>`;
    }

    const firstInSection = visible.find((v) => v.section.id === q.section.id);
    const sectionIntro = q.section.intro && firstInSection && firstInSection.id === q.id
      ? `<p class="hint">${esc(q.section.intro)}</p>` : "";

    render(`
      <div class="card">
        <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
        <div class="progress-label"><span>${esc(q.section.title)}</span><span>Question ${pos} of ${visible.length}</span></div>
        ${sectionIntro}
        <p class="question" id="qtext">${esc(q.text)}</p>
        ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ""}
        ${body}
        <div class="actions">
          ${history.length ? `<button class="btn link" id="back">← Back</button>` : `<button class="btn link" id="back">← Start over</button>`}
        </div>
      </div>`, q.type === "number" ? "#num" : ".answers .btn");

    app.querySelector("#back").onclick = goBack;

    if (q.type === "number") {
      app.querySelector("#numform").onsubmit = (e) => {
        e.preventDefault();
        const v = Number(app.querySelector("#num").value);
        if (!Number.isFinite(v) || v < q.min || v > q.max || app.querySelector("#num").value === "") {
          app.querySelector("#err").textContent = `Please enter a number between ${q.min} and ${q.max}.`;
          return;
        }
        answer(q, Math.round(v));
      };
    } else {
      app.querySelectorAll(".answers .btn").forEach((b) => {
        b.onclick = () => {
          const v = b.dataset.v;
          answer(q, q.type === "yesno" ? v === "yes" : v);
        };
      });
    }
  }

  function answer(q, value) {
    answers[q.id] = value;
    history = history.filter((id) => id !== q.id);
    history.push(q.id);
    // Changing an earlier answer can hide later questions; drop their answers.
    answers = Engine.pruneAnswers(KB, answers);
    history = history.filter((id) => id in answers);
    showNext();
  }

  function goBack() {
    if (!history.length) return showIntro();
    const last = history.pop();
    const q = Engine.allQuestions(KB).find((x) => x.id === last);
    // Keep the old answer so it shows as selected, but remove it from the
    // answered set so this question is the one shown.
    const prev = answers[last];
    delete answers[last];
    showQuestion(q);
    // re-mark the previous choice
    if (prev !== undefined) {
      const sel = q.type === "yesno" ? (prev ? "yes" : "no") : String(prev);
      app.querySelectorAll(".answers .btn").forEach((b) => b.classList.toggle("selected", b.dataset.v === sel));
      const num = app.querySelector("#num");
      if (num) num.value = prev;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
    const yes = app.querySelector('.answers .btn[data-v="yes"]');
    const no = app.querySelector('.answers .btn[data-v="no"]');
    const back = app.querySelector("#back");
    if (e.key === "y" && yes) yes.click();
    else if (e.key === "n" && no) no.click();
    else if (e.key === "Backspace" && back) { e.preventDefault(); back.click(); }
  });

  // ---------------------------------------------------------------- results
  function showResults() {
    const { results, reported } = Engine.assess(KB, answers);
    const strengthLabel = (s) => (s === "should" ? "Guideline: should" : "Guideline: consider");

    const cards = results
      .map((r) => {
        const isNhs = r.source === "nhs";
        return `
        <article class="result u-${r.urgency}">
          <div class="urgency">${esc(r.level.label)}</div>
          <p class="cancers">${isNhs ? esc(r.cancers.join(", ")) : "Linked in the guidelines to: " + esc(r.cancers.join(", "))}</p>
          <p class="muted" style="margin:0">${esc(r.level.detail)}</p>
          <div class="label">Because you said</div>
          <ul>${r.because.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
          ${r.alsoPresent.length ? `<div class="label">Also relevant</div><ul>${r.alsoPresent.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
          <div class="label">What doctors are advised to do</div>
          <ul>${r.actions.map((a) => `<li>${isNhs ? "" : `<span class="strength">${strengthLabel(a.strength)}</span>`}${esc(a.action)}</li>`).join("")}</ul>
          <div class="recs">${isNhs ? "Source: NHS urgent care advice" : "NICE NG12 recommendation " + r.recs.map(esc).join(", ")}</div>
        </article>`;
      })
      .join("");

    const none = `
      <div class="card">
        <h2>No guideline match</h2>
        <p>Your answers didn't match any of the NICE suspected-cancer referral criteria this tool checks.</p>
        <p>That doesn't rule anything out. This tool only covers symptoms you can notice yourself. See a doctor if a symptom
        lasts, gets worse, or worries you. Guidelines advise doctors to review people with symptoms that don't yet meet referral criteria.</p>
      </div>`;

    let xray = null;
    let summary = buildSummary(results, reported, xray);

    // Pair with the X-ray tool: prominent when the answers involve the chest.
    const chestFacts = ["cough", "haemoptysis", "breathless", "chest_pain", "chest_infections", "clubbing", "hoarseness"];
    const chestMatch = results.some((r) => r.group === "chest");
    const chestRelevant = chestMatch || chestFacts.some((f) => answers[f] === true);
    const xrayIntro = chestMatch
      ? `<p>Your answers matched the lung-related criteria above, and the usual first test is a chest X-ray.
         NICE rec 1.1.1 says that if a chest X-ray <em>report</em> suggests lung cancer, doctors should refer urgently.
         That means a radiologist's report, not this model.</p>
         <p class="muted">If you already have a chest X-ray image, you can add the research model's reading to this report.</p>`
      : `<p class="muted">You mentioned a chest symptom. If you already have a chest X-ray image, you can add the research model's reading to this report.</p>`;
    const xraySection = chestRelevant
      ? `<section class="card" style="margin-top:22px"><h2>Already had a chest X-ray?</h2>${xrayIntro}<div id="xray-widget"></div></section>`
      : `<details class="card more" style="margin-top:22px"><summary><strong>Add a chest X-ray (optional)</strong></summary>
           <p class="muted" style="margin-top:10px">If you have a chest X-ray image, you can add the research model's reading to this report.</p>
           <div id="xray-widget"></div></details>`;

    render(`
      <h1>Your results</h1>
      <p class="muted">Not a diagnosis. Each result means the guidelines say a doctor should check for that cancer, not that you have it.
      Most people who are checked turn out not to have cancer.</p>
      ${results.length ? cards : none}
      ${xraySection}
      <div class="card summary-box">
        <h3>Take this to your appointment</h3>
        <p class="muted" style="margin:0">A plain-text summary you can copy or print.</p>
        <pre id="summary">${esc(summary)}</pre>
        <div class="actions">
          <button class="btn" id="copy">Copy summary</button>
          <button class="btn" id="print">Print</button>
          <button class="btn" id="review">Change answers</button>
          <button class="btn primary" id="restart">Start over</button>
        </div>
      </div>`, "h1");

    app.querySelector("h1").setAttribute("tabindex", "-1");
    window.XrayWidget.mount(app.querySelector("#xray-widget"), {
      onResult(r) {
        xray = r;
        summary = buildSummary(results, reported, xray);
        app.querySelector("#summary").textContent = summary;
        app.querySelector("#copy").textContent = "Copy summary";
      },
    });
    app.querySelector("#copy").onclick = async (e) => {
      try {
        await navigator.clipboard.writeText(summary);
        e.target.textContent = "Copied";
      } catch {
        e.target.textContent = "Copy failed. Select the text instead";
      }
    };
    app.querySelector("#print").onclick = () => window.print();
    app.querySelector("#restart").onclick = showIntro;
    app.querySelector("#review").onclick = goBack;
  }

  function buildSummary(results, reported, xray) {
    const lines = [];
    lines.push(`Symptom checklist summary (${new Date().toLocaleDateString()})`);
    lines.push(`Age: ${answers.age}`);
    lines.push("");
    lines.push("Symptoms and history reported:");
    lines.push(...(reported.length ? reported.map((s) => `  - ${s}`) : ["  (none)"]));
    lines.push("");
    lines.push("NICE NG12 criteria matched:");
    if (!results.length) lines.push("  (none)");
    for (const r of results) {
      lines.push(`  - ${r.cancers.join(", ")}: ${r.level.label}${r.source === "nhs" ? " (NHS advice)" : ` (rec ${r.recs.join(", ")})`}`);
    }
    if (xray) {
      const f = (id) => xray.findings.find((x) => x.id === id);
      const fmt = (x) => `${x.label} ${x.score.toFixed(2)}${x.band === "high" ? " (above threshold)" : x.band === "borderline" ? " (borderline)" : ""}`;
      lines.push("");
      lines.push(`Chest X-ray, research model reading (${xray.model}, image: ${xray.name}):`);
      lines.push(`  ${xray.reading.text}`);
      lines.push(`  Cancer-related scores: ${["Mass", "Nodule", "Lung Lesion"].map((id) => fmt(f(id))).join("; ")}`);
      const other = xray.findings.filter((x) => !x.cancerRelated && x.band === "high");
      if (other.length) lines.push(`  Other findings above threshold: ${other.map(fmt).join("; ")}`);
      lines.push("  Scores are rescaled so 0.5 is the flagging threshold. Not a radiologist's report.");
    }
    lines.push("");
    lines.push("Generated by an educational research prototype. Not a diagnosis.");
    return lines.join("\n");
  }

  showIntro();
})();
