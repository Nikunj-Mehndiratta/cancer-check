# Cancer Check

**A research prototype that pairs a guideline-based cancer symptom checklist with an open-source chest X-ray model.**

> [!WARNING]
> **Not a medical device. Not for diagnosis.** This project is for research and education. It can't diagnose cancer or rule it out, it hasn't been clinically validated, and it shouldn't be used to make decisions about anyone's care. If you're worried about a symptom, see a doctor.

## What it does

**1. Symptom checklist** (`web/index.html`). It asks one question at a time, by body area, and shows follow-up questions only when they apply. It then reports which cancers the UK NICE guideline [NG12](https://www.nice.org.uk/guidance/ng12) links the answers to, how urgently NG12 says a doctor should be seen, why each result matched, and the recommendation number behind it.

**2. Chest X-ray research model** (`web/xray.html`). It scores a frontal chest X-ray (PNG, JPEG or DICOM) for 18 findings using [TorchXRayVision](https://github.com/mlmed/torchxrayvision), with class activation heatmaps. Mass, nodule and lung lesion are shown as the lung-cancer-related findings.

**Paired.** When the checklist's answers involve the chest, its results page offers the X-ray step, and the model's reading is added to the same printable summary. The X-ray page links back to the checklist.

Everything runs locally. Answers are not stored, and X-ray images are processed in memory by a server bound to `127.0.0.1`.

## Quick start

```bash
pip install -r requirements.txt
python server/app.py
```

Open http://localhost:8765. The first run downloads the model weights (28 MB) to `~/.torchxrayvision`.

The checklist also works on any static host (for example `python -m http.server --directory web`). Without the Python server, the X-ray step explains how to run it locally.

> **Windows note:** if the project sits in a very deep folder, `pip` can hit the 260-character path limit. Put the virtualenv somewhere short, such as `C:\venvs\cancer-check`.

## How it works

### Symptom checklist

| File | Role |
|---|---|
| `web/rules.js` | Knowledge base: questions, follow-ups, derived facts and 57 rules, each tagged with its NG12 recommendation number, urgency and strength ("should" vs "consider"). |
| `web/engine.js` | Pure rule engine (no DOM): picks the next question, prunes answers that no longer apply, evaluates rules, merges related results, and explains each match. |
| `web/app.js` | Click-through UI and the appointment summary. |

Rules use a small declarative condition language (`all`, `any`, `not`, `atLeast`, comparisons), so the knowledge base can be reviewed without reading code. Only recommendations that rely on things a person can notice themselves are included. Ones that need an examination or a test result (PSA, FIT, CA125, blood counts, imaging, dermoscopy) are left out.

### Chest X-ray model

| File | Role |
|---|---|
| `server/xray.py` | Image loading (PNG/JPEG/DICOM with VOI LUT and MONOCHROME1 handling), input checks, scoring with `densenet121-res224-all`, and class activation maps (the classifier is linear on pooled features, so CAM is exact). |
| `server/app.py` | FastAPI server: serves `web/` and `POST /api/xray`. |
| `web/xray.js` | Reusable upload, results and heatmap widget, used on both pages. |

Preprocessing matches TorchXRayVision's reference pipeline. Scores are operating-point normalised, so 0.5 is the model's flagging threshold. 0.45–0.55 is shown as *borderline*.

## Validation status

| What | Status |
|---|---|
| Rule logic vs NG12 wording (ages, AND/OR, durations, follow-ups) | 19 scenario tests: `node --test tests/engine.test.js` |
| Checklist UI | Manually tested end to end (adult, child and combined flows) |
| X-ray preprocessing | Matches TorchXRayVision's reference output on the bundled NIH sample |
| X-ray model accuracy | **Not evaluated by this project.** See the TorchXRayVision papers for published benchmarks. |
| Clinical validity of either tool | **Not evaluated.** Not reviewed by clinicians. |

## Known limitations

- **No out-of-distribution check.** Colour photos and MRI/CT/ultrasound DICOMs are rejected, but any other grey image (an MRI screenshot, a side-view X-ray) gets scored, and those scores are meaningless. TorchXRayVision's autoencoder could add this check (125 MB of extra weights).
- **No "cancer" output.** Mass, nodule and lung lesion are not cancer diagnoses. Most are benign.
- **UK guideline.** NG12 reflects referral practice in England. Thresholds and pathways differ in other countries.
- **Self-reported symptoms** can't replace examination: several NG12 criteria depend on what a clinician finds.
- **The heatmaps** show which regions raised a score. They don't segment lesions.

## Credits and licenses

Code: [MIT](LICENSE). To cite this project, see [CITATION.cff](CITATION.cff).

See [NOTICE.md](NOTICE.md) for NICE NG12, TorchXRayVision and NIH ChestX-ray14 attribution and terms. Model weights are downloaded at runtime and are not redistributed here.
