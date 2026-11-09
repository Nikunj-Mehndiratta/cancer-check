/*
 * Rule engine: walks the question list and matches answers against the rules
 * in rules.js. Pure functions, no DOM, so it runs in the browser and in Node tests.
 */
(function (root) {
  // A condition is true only if every fact it needs is known and matches.
  // Unanswered or skipped questions count as "no".
  function evaluate(cond, facts) {
    if (typeof cond === "string") return facts[cond] === true;
    if (cond.all) return cond.all.every((c) => evaluate(c, facts));
    if (cond.any) return cond.any.some((c) => evaluate(c, facts));
    if (cond.not) return !evaluate(cond.not, facts);
    if (cond.atLeast !== undefined) return cond.of.filter((c) => evaluate(c, facts)).length >= cond.atLeast;
    if (cond.f) {
      const v = facts[cond.f];
      if (v === undefined || v === null || v === "") return false;
      if ("eq" in cond) return v === cond.eq;
      if ("in" in cond) return cond.in.includes(v);
      if ("gte" in cond) return v >= cond.gte;
      if ("gt" in cond) return v > cond.gt;
      if ("lte" in cond) return v <= cond.lte;
      if ("lt" in cond) return v < cond.lt;
      return v === true;
    }
    throw new Error("Unknown condition: " + JSON.stringify(cond));
  }

  // Fact names a condition refers to (used to explain why a rule matched).
  function referencedFacts(cond, out = new Set()) {
    if (typeof cond === "string") out.add(cond);
    else if (cond.all || cond.any) (cond.all || cond.any).forEach((c) => referencedFacts(c, out));
    else if (cond.not) {
      /* "not" parts never explain a match */
    } else if (cond.of) cond.of.forEach((c) => referencedFacts(c, out));
    else if (cond.f) out.add(cond.f);
    return out;
  }

  function allQuestions(kb) {
    return kb.sections.flatMap((s) => s.questions.map((q) => ({ ...q, section: s })));
  }

  // Answers plus derived facts and scores.
  function computeFacts(kb, answers) {
    const facts = { ...answers };
    for (const [name, pairs] of Object.entries(kb.scores)) {
      facts[name] = pairs.reduce((sum, [id, w]) => sum + (answers[id] === true ? w : 0), 0);
    }
    // Derived facts can depend on each other, so evaluate in declaration order.
    for (const [name, cond] of Object.entries(kb.derived)) facts[name] = evaluate(cond, facts);
    return facts;
  }

  // Which questions should be asked, given the answers so far.
  function visibleQuestions(kb, answers) {
    const facts = computeFacts(kb, answers);
    return allQuestions(kb).filter((q) => !q.askIf || evaluate(q.askIf, facts));
  }

  function nextQuestion(kb, answers) {
    return visibleQuestions(kb, answers).find((q) => !(q.id in answers)) || null;
  }

  // Remove answers to questions that no longer apply (e.g. after going back
  // and changing age), so hidden answers can't trigger rules.
  function pruneAnswers(kb, answers) {
    let current = { ...answers };
    for (;;) {
      const visible = new Set(visibleQuestions(kb, current).map((q) => q.id));
      const pruned = Object.fromEntries(Object.entries(current).filter(([id]) => visible.has(id)));
      if (Object.keys(pruned).length === Object.keys(current).length) return pruned;
      current = pruned;
    }
  }

  function assess(kb, answers) {
    const clean = pruneAnswers(kb, answers);
    const facts = computeFacts(kb, clean);
    const questionsById = Object.fromEntries(allQuestions(kb).map((q) => [q.id, q]));

    // Human-readable reasons: the answers a condition depends on that were
    // "yes" (expanding derived facts and scores), plus age when it matters.
    const reasons = (cond, seen = new Set()) => {
      const out = [];
      for (const f of referencedFacts(cond)) {
        if (seen.has(f)) continue;
        seen.add(f);
        if (f === "age") out.push(`age ${clean.age}`);
        else if (kb.scores[f]) out.push(...kb.scores[f].filter(([id]) => clean[id] === true).map(([id]) => questionsById[id].short));
        else if (kb.derived[f]) out.push(...reasons(kb.derived[f], seen));
        else if (f === "uti_link") out.push(questionsById.uti_link.short);
        else if (clean[f] === true && questionsById[f]) out.push(questionsById[f].short);
      }
      return out;
    };

    const matches = kb.rules
      .filter((r) => evaluate(r.when, facts))
      .map((r) => ({
        ...r,
        because: [...new Set(reasons(r.when))],
        alsoPresent: (r.alsoNote || []).filter((id) => clean[id] === true).map((id) => questionsById[id].short),
        level: kb.urgencyLevels[r.urgency],
      }));

    // Merge by group: keep the most urgent rule's urgency, combine everything else.
    const groups = new Map();
    for (const m of matches) {
      const g = groups.get(m.group);
      if (!g) {
        groups.set(m.group, { ...m, actions: [{ action: m.action, strength: m.strength, recs: m.recs, urgency: m.urgency }] });
        continue;
      }
      const top = m.level.rank > g.level.rank ? m : g;
      groups.set(m.group, {
        ...g,
        urgency: top.urgency,
        level: top.level,
        strength: m.strength === "should" || g.strength === "should" ? "should" : "consider",
        source: g.source || m.source,
        cancers: [...new Set([...g.cancers, ...m.cancers])],
        recs: [...new Set([...g.recs, ...m.recs])],
        because: [...new Set([...g.because, ...m.because])],
        alsoPresent: [...new Set([...g.alsoPresent, ...m.alsoPresent])],
        actions: [...g.actions, { action: m.action, strength: m.strength, recs: m.recs, urgency: m.urgency }].sort(
          (a, b) => kb.urgencyLevels[b.urgency].rank - kb.urgencyLevels[a.urgency].rank
        ),
      });
    }
    const results = [...groups.values()].sort((a, b) => b.level.rank - a.level.rank);

    const reported = allQuestions(kb)
      .filter((q) => clean[q.id] === true && q.type === "yesno")
      .map((q) => q.short);

    return { results, reported, answers: clean, facts };
  }

  const Engine = { evaluate, computeFacts, visibleQuestions, nextQuestion, pruneAnswers, assess, allQuestions };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
