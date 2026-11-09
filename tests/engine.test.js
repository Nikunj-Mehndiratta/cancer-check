// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const KB = require("../web/rules.js");
const Engine = require("../web/engine.js");

const groups = (answers) => Engine.assess(KB, answers).results.map((r) => r.group);
const find = (answers, group) => Engine.assess(KB, answers).results.find((r) => r.group === group);

test("every rule and question references facts that exist", () => {
  const known = new Set([
    ...Engine.allQuestions(KB).map((q) => q.id),
    ...Object.keys(KB.derived),
    ...Object.keys(KB.scores),
  ]);
  const walk = (c, where) => {
    if (typeof c === "string") return assert.ok(known.has(c), `${where}: unknown fact "${c}"`);
    if (c.all || c.any) return (c.all || c.any).forEach((x) => walk(x, where));
    if (c.not) return walk(c.not, where);
    if (c.of) return c.of.forEach((x) => walk(x, where));
    assert.ok(known.has(c.f), `${where}: unknown fact "${c.f}"`);
  };
  KB.rules.forEach((r) => walk(r.when, "rule " + r.id));
  Object.entries(KB.derived).forEach(([k, c]) => walk(c, "derived " + k));
  Engine.allQuestions(KB).forEach((q) => q.askIf && walk(q.askIf, "question " + q.id));
  KB.rules.forEach((r) => assert.ok(KB.urgencyLevels[r.urgency], `rule ${r.id}: bad urgency`));
});

test("no symptoms -> no results", () => {
  assert.deepEqual(groups({ age: 45, sex: "male", smoked: false }), []);
});

test("lung 1.1.1: 40+ coughing up blood -> 2 week referral", () => {
  const r = find({ age: 52, haemoptysis: true }, "chest");
  assert.equal(r.urgency, "2wk");
  assert.ok(r.because.includes("coughing up blood"));
  assert.ok(r.because.includes("age 52"));
});

test("lung 1.1.1 does not apply under 40", () => {
  assert.equal(find({ age: 35, haemoptysis: true }, "chest"), undefined);
});

test("lung 1.1.2: one symptom only counts if ever smoked", () => {
  assert.equal(find({ age: 50, cough: true, smoked: false }, "chest"), undefined);
  assert.ok(find({ age: 50, cough: true, smoked: true }, "chest"));
  assert.ok(find({ age: 50, cough: true, fatigue: true, smoked: false }, "chest"));
});

test("mesothelioma 1.1.5: asbestos + one symptom", () => {
  // Asbestos counts for mesothelioma (1.1.5) but not lung cancer (1.1.2).
  assert.deepEqual(find({ age: 60, smoked: false, asbestos: true, breathless: true }, "chest").cancers, ["Mesothelioma"]);
  assert.deepEqual(find({ age: 60, smoked: true, breathless: true }, "chest").cancers, ["Lung cancer", "Mesothelioma"]);
});

test("oesophageal/stomach 1.2.1: dysphagia at any age", () => {
  assert.equal(find({ age: 30, dysphagia: true }, "upper_gi").urgency, "2wk");
});

test("1.2.1 age 55+ weight loss + reflux", () => {
  assert.ok(find({ age: 58, weight_loss: true, reflux: true }, "upper_gi"));
  assert.equal(find({ age: 50, weight_loss: true, reflux: true }, "upper_gi"), undefined);
});

test("colorectal 1.3.1 age split for rectal bleeding", () => {
  assert.equal(find({ age: 45, rectal_bleeding: true }, "colorectal"), undefined);
  assert.ok(find({ age: 45, rectal_bleeding: true, abd_pain: true }, "colorectal"));
  assert.ok(find({ age: 55, rectal_bleeding: true }, "colorectal"));
});

test("breast 1.4.1 vs 1.4.3 by age", () => {
  assert.equal(find({ age: 35, breast_lump: true }, "breast").urgency, "2wk");
  assert.equal(find({ age: 25, breast_lump: true }, "breast").urgency, "routine");
});

test("melanoma 1.7.1: weighted score >= 3", () => {
  // size (2) alone = 2 -> no referral
  assert.equal(find({ age: 40, mole: true, mole_size: true }, "melanoma"), undefined);
  // size (2) + itch (1) = 3 -> referral
  assert.ok(find({ age: 40, mole: true, mole_size: true, mole_sensation: true }, "melanoma"));
});

test("haematuria 1.6.4: cleared after UTI treatment does not trigger", () => {
  assert.equal(find({ age: 50, blood_urine: true, uti_link: "cleared" }, "bladder_kidney"), undefined);
  assert.ok(find({ age: 50, blood_urine: true, uti_link: "no_uti" }, "bladder_kidney"));
  assert.ok(find({ age: 50, blood_urine: true, uti_link: "persisted" }, "bladder_kidney"));
});

test("endometrial: post-menopausal bleeding, HRT vs not", () => {
  assert.equal(find({ age: 60, sex: "female", pmb: true, pmb_hrt: false }, "endometrial").urgency, "2wk");
  assert.equal(find({ age: 60, sex: "female", pmb: true, pmb_hrt: true }, "endometrial").urgency, "soon");
});

test("sex-specific questions are hidden and their answers pruned", () => {
  // A stale male-only answer must not trigger anything for someone who chose female.
  assert.equal(find({ age: 40, sex: "female", testis_change: true }, "testicular"), undefined);
  const ids = Engine.visibleQuestions(KB, { age: 40, sex: "female" }).map((q) => q.id);
  assert.ok(!ids.includes("testis_change"));
  assert.ok(ids.includes("vulva"));
});

test("children: petechiae -> same-day; adult -> 48h blood test", () => {
  assert.equal(find({ age: 8, petechiae: true }, "leukaemia").urgency, "emergency");
  assert.equal(find({ age: 40, petechiae: true }, "leukaemia").urgency, "48h");
});

test("young person 18-24 with neck lump: lymphoma group merged at 48h", () => {
  const r = find({ age: 20, neck_lump: true }, "lymphoma");
  assert.equal(r.urgency, "48h");
  assert.ok(r.recs.includes("1.10.6") && r.recs.includes("1.10.7"));
});

test("vomiting blood -> emergency, listed first", () => {
  const res = Engine.assess(KB, { age: 30, vomit_blood: true, dysphagia: true }).results;
  assert.equal(res[0].group, "vomit_blood");
  assert.equal(res[0].urgency, "emergency");
});

test("follow-up questions only appear after a yes", () => {
  const before = Engine.visibleQuestions(KB, { age: 50 }).map((q) => q.id);
  assert.ok(!before.includes("mole_size"));
  const after = Engine.visibleQuestions(KB, { age: 50, mole: true }).map((q) => q.id);
  assert.ok(after.includes("mole_size"));
});

test("walking the whole questionnaire answering 'no' terminates", () => {
  const answers = {};
  let q, steps = 0;
  while ((q = Engine.nextQuestion(KB, answers)) && steps++ < 500) {
    answers[q.id] = q.type === "number" ? 50 : q.type === "choice" ? q.options[0].value : false;
  }
  assert.ok(steps < 500);
  assert.deepEqual(Engine.assess(KB, answers).results, []);
});
