/*
 * Chest X-ray widget. Used standalone on xray.html and embedded in the
 * symptom checklist results.
 *
 *   XrayWidget.mount(element, { onResult(result) {} })
 *
 * Needs the local Python server (server/app.py) for /api/xray. On a static
 * host (e.g. GitHub Pages) it explains how to run it locally instead.
 */
(function (root) {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SAMPLE = { url: "samples/nih-00000001_000.png", name: "NIH sample 00000001_000.png" };

  let serverCheck = null;
  function serverAvailable() {
    if (!serverCheck) {
      serverCheck = fetch("api/health", { cache: "no-store" })
        .then((r) => r.ok && r.json())
        .then((j) => Boolean(j && j.ok))
        .catch(() => false);
    }
    return serverCheck;
  }

  const OFFLINE_HTML = `<div class="warn">
      <strong>The X-ray model isn't available on this page.</strong> It runs on your own computer, so images never leave it.
      To use it, download the project and start the local server:
      <pre style="margin:8px 0 0;white-space:pre-wrap"><code>pip install -r requirements.txt
python server/app.py</code></pre>
      then open <code>http://localhost:8765</code>. The symptom checklist works without it.
    </div>`;

  function findingButton(f, heatmaps) {
    const pct = Math.round(f.score * 100);
    const chip =
      f.band === "high" ? '<span class="flag-chip">above threshold</span>'
      : f.band === "borderline" ? '<span class="flag-chip borderline">borderline</span>' : "";
    const meter = f.band === "high" ? "flag" : f.band === "borderline" ? "border" : "";
    return `<button class="finding" data-id="${esc(f.id)}" ${f.id in heatmaps ? "" : 'data-noheat="1"'}>
        <span class="name">${esc(f.label)}${chip}</span>
        <span class="val">${f.score.toFixed(2)}</span>
        <div class="meter ${meter}" aria-hidden="true"><div style="width:${Math.min(pct, 100)}%"></div></div>
        <span class="desc">${esc(f.description)}</span>
      </button>`;
  }

  // Plain-language reading of the cancer-related scores, shared with the combined report.
  function interpret(findings) {
    const cancer = findings.filter((f) => f.cancerRelated);
    const high = cancer.filter((f) => f.band === "high");
    const border = cancer.filter((f) => f.band === "borderline");
    const names = (fs) => fs.map((f) => f.label.toLowerCase()).join(" and ");
    if (high.length) return { level: "high", names: names(high), text: `The model scored ${names(high)} clearly above its threshold.` };
    if (border.length) return { level: "borderline", names: names(border), text: `The model's ${names(border)} score is borderline (close to 0.5), so it's inconclusive.` };
    return { level: "low", names: "", text: "No lung-cancer-related finding scored near or above the model's threshold." };
  }

  function mount(el, opts = {}) {
    el.innerHTML = `
      <label class="drop">
        <input type="file" accept=".png,.jpg,.jpeg,.dcm,.dicom,image/png,image/jpeg,application/dicom" />
        <strong>Choose a chest X-ray image, or drop it here</strong>
        <span class="muted">PNG, JPEG or DICOM. Processed on this computer only. The image is not saved.</span>
      </label>
      <p class="muted" style="font-size:14px;margin-top:10px">No X-ray to hand?
        <button type="button" class="btn link sample-btn" style="color:var(--accent);padding:0">Try a sample X-ray</button>
        (public NIH ChestX-ray14 image, labelled as an enlarged heart).</p>
      <div class="xr-status" aria-live="polite" style="margin-top:14px"></div>
      <div class="xr-result"></div>`;

    const q = (s) => el.querySelector(s);
    const drop = q(".drop");
    const input = q("input[type=file]");
    const status = q(".xr-status");
    const result = q(".xr-result");

    serverAvailable().then((ok) => {
      if (!ok) {
        drop.hidden = true;
        q(".sample-btn").parentElement.hidden = true;
        status.innerHTML = OFFLINE_HTML;
      }
    });

    q(".sample-btn").addEventListener("click", async () => {
      const blob = await (await fetch(SAMPLE.url)).blob();
      analyse(new File([blob], SAMPLE.name, { type: "image/png" }));
    });
    input.addEventListener("change", () => input.files[0] && analyse(input.files[0]));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => e.dataTransfer.files[0] && analyse(e.dataTransfer.files[0]));

    async function analyse(file) {
      result.innerHTML = "";
      status.innerHTML = `<span class="spinner"></span>Analysing <strong>${esc(file.name)}</strong>…`;
      const body = new FormData();
      body.append("file", file);
      let res, data;
      try {
        res = await fetch("api/xray", { method: "POST", body });
        data = await res.json();
      } catch {
        status.innerHTML = OFFLINE_HTML;
        return;
      }
      if (!res.ok) {
        status.innerHTML = `<div class="notice">${esc(data.detail || "Analysis failed.")}</div>`;
        return;
      }
      status.innerHTML = "";
      render(file.name, data);
      if (opts.onResult) opts.onResult({ name: file.name, ...data, reading: interpret(data.findings) });
    }

    function render(name, data) {
      const heatmaps = data.heatmaps;
      const cancer = data.findings.filter((f) => f.cancerRelated);
      const other = data.findings.filter((f) => !f.cancerRelated);
      const otherHigh = other.filter((f) => f.band === "high");
      const otherRest = other.filter((f) => f.band !== "high");
      const first = cancer.slice().sort((a, b) => b.score - a.score)[0];
      const r = interpret(data.findings);

      const summary =
        r.level === "high"
          ? `<div class="warn">The model scored <strong>${esc(r.names)}</strong> clearly above its threshold.
             That is <strong>not</strong> a diagnosis: most masses and nodules are not cancer, and this model makes mistakes.
             If this is a real scan, ask your doctor about the radiologist's report.</div>`
          : r.level === "borderline"
          ? `<div class="warn">The model's <strong>${esc(r.names)}</strong> score is borderline (close to 0.5).
             Near the threshold the model can't really tell either way, so treat it as inconclusive, not as a finding.</div>`
          : `<div class="card" style="padding:14px 16px;margin-bottom:12px">No lung-cancer-related finding scored near or above the model's threshold.
             That doesn't rule anything out: models like this miss findings, especially small ones.</div>`;

      result.innerHTML = `
        <div class="xr-layout">
          <div>
            <div class="viewer">
              <img src="${data.image}" alt="Uploaded X-ray, centre-cropped to a square" />
              <img class="heat" alt="" />
            </div>
            <div class="viewer-bar">
              <span class="heat-label">Heatmap: none</span>
              <label>Overlay <input type="range" class="opacity" min="0" max="100" value="80" /></label>
            </div>
            <p class="muted" style="font-size:13px;margin-top:8px">${esc(name)} · centre-cropped and resized to 224×224 for the model.
            Warmer colours mark the regions that raised the selected score. They don't outline a lesion.</p>
          </div>
          <div>
            ${summary}
            <h3>Lung-cancer-related findings</h3>
            ${cancer.map((f) => findingButton(f, heatmaps)).join("")}
            ${otherHigh.length ? `<h3 style="margin-top:16px">Other findings clearly above threshold</h3>${otherHigh.map((f) => findingButton(f, heatmaps)).join("")}` : ""}
            ${otherRest.length ? `<details class="more"><summary>Other findings (${otherRest.length})</summary>${otherRest.map((f) => findingButton(f, heatmaps)).join("")}</details>` : ""}
            <p class="muted" style="font-size:13px">Bar marker = 0.5, the model's flagging threshold. 0.45–0.55 counts as borderline. Click a finding to see its heatmap.</p>
          </div>
        </div>`;

      const heat = result.querySelector(".heat");
      const opacity = result.querySelector(".opacity");
      const label = result.querySelector(".heat-label");
      opacity.oninput = () => (heat.style.opacity = opacity.value / 100);
      heat.style.opacity = 0.8;

      const select = (id) => {
        result.querySelectorAll(".finding").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
        const f = data.findings.find((x) => x.id === id);
        if (heatmaps[id]) {
          heat.src = heatmaps[id];
          heat.hidden = false;
          label.textContent = `Heatmap: ${f.label} (${f.score.toFixed(2)})`;
        } else {
          heat.hidden = true;
          label.textContent = `No heatmap for ${f.label}: no part of the image raised this score`;
        }
      };
      result.querySelectorAll(".finding").forEach((b) => (b.onclick = () => select(b.dataset.id)));
      if (first) select(first.id);
    }
  }

  root.XrayWidget = { mount, interpret, serverAvailable };
})(window);
