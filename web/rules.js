/*
 * Knowledge base for the symptom checklist.
 *
 * Source: NICE guideline NG12 "Suspected cancer: recognition and referral"
 * (published 2015, last updated 15 April 2026),
 * https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer
 *
 * Only recommendations that depend on things a person can notice themselves are
 * included. Recommendations that need an examination, imaging or a lab result
 * (chest X-ray findings, PSA, FIT, CA125, platelet counts, dermoscopy, etc.)
 * are left out. The rules are paraphrased; check the guideline itself before
 * relying on any of them.
 *
 * Condition language (evaluated by engine.js):
 *   "cough"                       -> fact is true
 *   { f: "age", gte: 40 }         -> comparison (gte, gt, lte, lt, eq, in)
 *   { all: [...] } { any: [...] } { not: cond }
 *   { atLeast: 2, of: [...] }     -> at least N of the listed conditions
 */
(function (root) {
  const SOURCE_URL =
    "https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer";

  const female = { f: "sex", eq: "female" };
  const male = { f: "sex", eq: "male" };
  const age = (op, n) => ({ f: "age", [op]: n });

  // ---------------------------------------------------------------- questions
  // Asked one at a time, in this order. `askIf` hides a question when it
  // doesn't apply (follow-ups, age- or sex-specific questions).
  // `short` is the label used when explaining a result.
  const sections = [
    {
      id: "about",
      title: "About you",
      questions: [
        { id: "age", type: "number", text: "How old are you?", hint: "If you're filling this in for a child, answer every question for them.", short: "age", min: 0, max: 120 },
        {
          id: "sex", type: "choice", text: "Which reproductive organs do you have?",
          hint: "Some cancers only affect certain organs. This only decides which questions you're asked.",
          short: "reproductive organs",
          options: [
            { value: "female", label: "Female organs (womb, ovaries)" },
            { value: "male", label: "Male organs (prostate, testicles)" },
            { value: "skip", label: "Prefer not to say (skip those questions)" },
          ],
        },
        { id: "smoked", type: "yesno", text: "Have you ever smoked?", short: "have smoked", askIf: age("gte", 16) },
        { id: "asbestos", type: "yesno", text: "Have you ever been exposed to asbestos?", hint: "For example working in construction, shipbuilding, demolition or plumbing in older buildings.", short: "asbestos exposure", askIf: age("gte", 40) },
      ],
    },
    {
      id: "general",
      title: "Whole body",
      questions: [
        { id: "weight_loss", type: "yesno", text: "Have you lost weight without trying?", short: "unexplained weight loss" },
        { id: "weight_loss_5pct", type: "yesno", text: "Have you lost more than 5% of your body weight in the last 6 months?", hint: "For example more than 3.5 kg (8 lb) if you weighed 70 kg (11 st).", short: "lost more than 5% of body weight in 6 months", askIf: { all: ["weight_loss", age("gte", 60)] } },
        { id: "appetite_loss", type: "yesno", text: "Have you lost your appetite without an obvious reason?", short: "unexplained appetite loss" },
        { id: "fatigue", type: "yesno", text: "Have you felt unusually tired for 3 weeks or more, without an obvious reason?", short: "persistent tiredness" },
        { id: "fever", type: "yesno", text: "Have you had fevers you can't explain (not from a cold, flu or other infection)?", short: "unexplained fever" },
        { id: "night_sweats", type: "yesno", text: "Have you had drenching night sweats?", short: "night sweats" },
        { id: "itching", type: "yesno", text: "Have you had itching all over your body without a rash?", short: "itching without a rash" },
        { id: "pale", type: "yesno", text: "Have you (or people around you) noticed you looking unusually pale?", short: "looking pale" },
        { id: "infections", type: "yesno", text: "Do you keep getting infections, or have an infection that won't clear?", short: "infections that keep coming back or won't clear" },
        { id: "bruising", type: "yesno", text: "Have you been bruising easily, without knocking yourself?", short: "unexplained bruising" },
        { id: "bleeding", type: "yesno", text: "Have you had unusual bleeding, like nosebleeds or bleeding gums, that you can't explain?", short: "unexplained bleeding" },
        { id: "petechiae", type: "yesno", text: "Have you noticed tiny red, purple or brown spots on the skin that don't fade when you press a glass on them?", short: "small spots that don't fade under a glass (petechiae)" },
        { id: "dvt", type: "yesno", text: "Have you been diagnosed with a blood clot in a leg (deep vein thrombosis) recently?", short: "deep vein thrombosis" },
      ],
    },
    {
      id: "chest",
      title: "Chest and breathing",
      questions: [
        { id: "cough", type: "yesno", text: "Have you had a cough for 3 weeks or more?", short: "cough lasting 3+ weeks" },
        { id: "haemoptysis", type: "yesno", text: "Have you coughed up blood?", short: "coughing up blood" },
        { id: "breathless", type: "yesno", text: "Have you been getting short of breath without an obvious reason?", short: "unexplained shortness of breath" },
        { id: "chest_pain", type: "yesno", text: "Have you had chest pain you can't explain?", hint: "If you have chest pain right now that is crushing, spreads to your arm, jaw or back, or comes with sweating or breathlessness, call emergency services.", short: "unexplained chest pain" },
        { id: "chest_infections", type: "yesno", text: "Have you had a chest infection that keeps coming back or won't go away?", short: "persistent or recurring chest infections" },
        { id: "clubbing", type: "yesno", text: "Have the tips of your fingers become wider and rounder, with the nails curving over them?", hint: "This is called finger clubbing.", short: "finger clubbing" },
        { id: "hoarseness", type: "yesno", text: "Has your voice been hoarse for 3 weeks or more, without a cold or other obvious cause?", short: "persistent hoarseness" },
      ],
    },
    {
      id: "lumps",
      title: "Lumps, bones and swellings",
      questions: [
        { id: "neck_lump", type: "yesno", text: "Do you have a lump or swelling in your neck, or just above your collarbone, that has lasted 3 weeks or more?", short: "persistent neck lump" },
        { id: "thyroid_lump", type: "yesno", text: "Do you have a lump at the front of your neck that moves up and down when you swallow?", short: "lump at the front of the neck (thyroid)" },
        { id: "armpit_lump", type: "yesno", text: "Do you have a lump in your armpit you can't explain?", short: "lump in the armpit" },
        { id: "groin_lump", type: "yesno", text: "Do you have a lump in your groin you can't explain?", short: "lump in the groin" },
        { id: "glands_many", type: "yesno", text: "Do you have swollen glands in several places at once (for example neck, armpits and groin)?", short: "swollen glands in several places" },
        { id: "growing_lump", type: "yesno", text: "Do you have a lump anywhere on your body that is getting bigger?", short: "a lump that is getting bigger" },
        { id: "bone_pain", type: "yesno", text: "Have you had bone pain that won't go away, or that you can't explain?", short: "persistent or unexplained bone pain" },
        { id: "back_pain", type: "yesno", text: "Have you had back pain that won't go away?", short: "persistent back pain" },
        { id: "bone_swelling", type: "yesno", text: "Is there a swelling over a bone you can't explain?", short: "unexplained bone swelling", askIf: age("lt", 25) },
        { id: "fracture", type: "yesno", text: "Have you broken a bone without a fall or injury that would explain it?", short: "unexplained broken bone", askIf: age("gte", 60) },
      ],
    },
    {
      id: "mouth",
      title: "Mouth and throat",
      questions: [
        { id: "dysphagia", type: "yesno", text: "Have you had trouble swallowing, or felt food sticking on the way down?", short: "difficulty swallowing" },
        { id: "mouth_ulcer", type: "yesno", text: "Do you have a mouth ulcer that has lasted more than 3 weeks?", short: "mouth ulcer lasting 3+ weeks" },
        { id: "mouth_lump", type: "yesno", text: "Do you have a lump on your lip or inside your mouth?", short: "lump on the lip or in the mouth" },
        { id: "mouth_patch", type: "yesno", text: "Do you have a red, or red and white, patch inside your mouth?", short: "red or red-and-white patch in the mouth" },
      ],
    },
    {
      id: "gut",
      title: "Stomach and bowel",
      questions: [
        { id: "vomit_blood", type: "yesno", text: "Have you vomited blood, or vomit that looks like coffee grounds?", short: "vomiting blood" },
        { id: "upper_abd_pain", type: "yesno", text: "Have you had pain in the upper part of your tummy (above the belly button)?", short: "upper tummy pain" },
        { id: "reflux", type: "yesno", text: "Have you had acid reflux or heartburn?", short: "acid reflux" },
        { id: "dyspepsia", type: "yesno", text: "Have you had indigestion?", short: "indigestion" },
        { id: "dyspepsia_resistant", type: "yesno", text: "Has the indigestion carried on even though you've taken treatment for it?", short: "indigestion that hasn't responded to treatment", askIf: { all: ["dyspepsia", age("gte", 55)] } },
        { id: "nausea", type: "yesno", text: "Have you been feeling sick or vomiting?", short: "nausea or vomiting" },
        { id: "abd_pain", type: "yesno", text: "Have you had tummy (abdominal) or pelvic pain you can't explain?", short: "unexplained tummy or pelvic pain" },
        { id: "abd_lump", type: "yesno", text: "Can you feel a lump in your tummy?", short: "a lump in the tummy" },
        { id: "abd_lump_upper", type: "yesno", text: "Is the lump in the upper part of your tummy (above the belly button)?", short: "lump in the upper tummy", askIf: "abd_lump" },
        { id: "bloating", type: "yesno", text: "Has your tummy felt swollen or bloated most days?", short: "persistent bloating" },
        { id: "early_full", type: "yesno", text: "Do you feel full very quickly when eating?", short: "feeling full quickly" },
        { id: "bowel_change", type: "yesno", text: "Have your bowel habits changed (going more or less often, or looser or harder poo) for 3 weeks or more?", short: "change in bowel habit" },
        { id: "diarrhoea", type: "yesno", text: "Has the change included diarrhoea (looser or more frequent poo)?", short: "diarrhoea", askIf: "bowel_change" },
        { id: "constipation", type: "yesno", text: "Has the change included constipation?", short: "constipation", askIf: "bowel_change" },
        { id: "rectal_bleeding", type: "yesno", text: "Have you noticed blood in your poo or bleeding from your bottom?", short: "bleeding from the bottom" },
        { id: "anal_lump", type: "yesno", text: "Do you have a lump or sore (ulcer) around your anus that you can't explain?", short: "unexplained lump or sore at the anus" },
        { id: "jaundice", type: "yesno", text: "Have your skin or the whites of your eyes turned yellow?", hint: "This is called jaundice.", short: "yellow skin or eyes (jaundice)" },
        { id: "new_diabetes", type: "yesno", text: "Have you been diagnosed with diabetes in the last year or so?", short: "newly diagnosed diabetes", askIf: age("gte", 60) },
      ],
    },
    {
      id: "breast",
      title: "Breasts",
      intro: "Breast cancer can affect anyone, including men.",
      questions: [
        { id: "breast_lump", type: "yesno", text: "Have you found a lump in a breast or chest that you can't explain (painful or not)?", short: "unexplained breast lump" },
        { id: "nipple_change", type: "yesno", text: "Has one nipple (only one) changed? For example discharge, turning inwards, or another change that worries you.", short: "change in one nipple" },
        { id: "breast_skin", type: "yesno", text: "Has the skin on a breast changed? For example dimpling, puckering, a rash, or skin like orange peel.", short: "breast skin changes" },
      ],
    },
    {
      id: "uro",
      title: "Urine and genitals",
      questions: [
        { id: "blood_urine", type: "yesno", text: "Have you seen blood in your urine (pee)?", short: "visible blood in urine" },
        {
          id: "uti_link", type: "choice", text: "Was the blood in your urine linked to a urine infection?",
          short: "blood in urine not explained by an infection",
          askIf: "blood_urine",
          options: [
            { value: "no_uti", label: "No, there was no urine infection" },
            { value: "persisted", label: "Yes, but it continued or came back after the infection was treated" },
            { value: "cleared", label: "Yes, and it stopped once the infection was treated" },
            { value: "unsure", label: "I'm not sure" },
          ],
        },
        { id: "recurrent_uti", type: "yesno", text: "Do you keep getting urine infections, or have one that won't clear?", short: "recurring or persistent urine infections", askIf: age("gte", 60) },
        // male
        { id: "luts", type: "yesno", text: "Have you had problems peeing? For example needing to go often or urgently, getting up at night, trouble starting, or not being able to empty fully.", short: "urinary symptoms", askIf: male },
        { id: "erectile", type: "yesno", text: "Have you had erection problems (erectile dysfunction)?", short: "erectile dysfunction", askIf: { all: [male, age("gte", 18)] } },
        { id: "testis_change", type: "yesno", text: "Has a testicle got bigger, or changed shape or texture, without pain?", short: "painless change in a testicle", askIf: male },
        { id: "testis_other", type: "yesno", text: "Have you had other testicle symptoms that won't go away?", short: "persistent testicle symptoms", askIf: male },
        { id: "penis", type: "yesno", text: "Do you have a lump, sore or other symptom on your penis, foreskin or glans that won't go away (including after treatment for an infection)?", short: "persistent penile lump, sore or symptom", askIf: male },
        // female
        { id: "urinary_freq_f", type: "yesno", text: "Have you needed to pee more often or more urgently than usual?", short: "needing to pee more often or urgently", askIf: female },
        { id: "pmb", type: "yesno", text: "Have you had vaginal bleeding after your periods stopped for good (after menopause)?", hint: "Answer no if you haven't been through menopause.", short: "bleeding after menopause", askIf: { all: [female, age("gte", 35)] } },
        { id: "pmb_hrt", type: "yesno", text: "Are you taking hormone replacement therapy (HRT)?", short: "taking HRT", askIf: "pmb" },
        { id: "vaginal_discharge", type: "yesno", text: "Have you had unusual vaginal discharge for the first time, without an obvious cause?", short: "new unexplained vaginal discharge", askIf: { all: [female, age("gte", 55)] } },
        { id: "vulva", type: "yesno", text: "Do you have a lump, sore or bleeding on your vulva that you can't explain?", short: "unexplained vulval lump, sore or bleeding", askIf: female },
        { id: "vaginal_lump", type: "yesno", text: "Can you feel a lump inside or at the entrance to your vagina?", short: "lump in or at the entrance to the vagina", askIf: female },
        {
          id: "ovarian_freq", type: "yesno",
          text: "Do the bloating, feeling full, tummy or pelvic pain, or needing to pee often happen on more than 12 days a month?",
          short: "these symptoms on more than 12 days a month",
          askIf: { all: [female, { any: ["bloating", "early_full", "appetite_loss", "abd_pain", "urinary_freq_f"] }] },
        },
        { id: "ibs_new", type: "yesno", text: "In the last 12 months, have you started having symptoms like irritable bowel syndrome (IBS) for the first time?", hint: "For example bloating, cramps, or switching between diarrhoea and constipation.", short: "new IBS-like symptoms", askIf: { all: [female, age("gte", 50)] } },
      ],
    },
    {
      id: "skin",
      title: "Skin",
      questions: [
        { id: "mole", type: "yesno", text: "Do you have a mole or dark spot on your skin that is new or has changed?", short: "new or changing mole" },
        { id: "mole_size", type: "yesno", text: "Has it got bigger?", short: "mole getting bigger", askIf: "mole", weight: 2 },
        { id: "mole_shape", type: "yesno", text: "Does it have an uneven or irregular shape or edge?", short: "irregular mole shape", askIf: "mole", weight: 2 },
        { id: "mole_colour", type: "yesno", text: "Is it more than one colour, or an uneven colour?", short: "irregular mole colour", askIf: "mole", weight: 2 },
        { id: "mole_7mm", type: "yesno", text: "Is it 7 mm across or bigger (about the width of a pencil eraser)?", short: "mole 7 mm or larger", askIf: "mole", weight: 1 },
        { id: "mole_inflamed", type: "yesno", text: "Is it red, swollen or inflamed?", short: "inflamed mole", askIf: "mole", weight: 1 },
        { id: "mole_ooze", type: "yesno", text: "Is it oozing, crusting or bleeding?", short: "oozing mole", askIf: "mole", weight: 1 },
        { id: "mole_sensation", type: "yesno", text: "Does it feel different, for example itchy or painful?", short: "change in how the mole feels", askIf: "mole", weight: 1 },
        { id: "skin_nodule", type: "yesno", text: "Do you have a firm, raised lump on your skin that has appeared recently and is growing quickly (any colour)?", short: "fast-growing raised skin lump" },
        { id: "skin_scaly", type: "yesno", text: "Do you have a scaly, crusty or sore patch or lump on your skin that is growing, bleeds, or hasn't healed after 4 weeks?", short: "non-healing scaly or crusty skin patch" },
        { id: "skin_pearly", type: "yesno", text: "Do you have a shiny, pearly or waxy bump, or a sore with a raised edge and tiny blood vessels on it?", short: "pearly bump or sore with a raised edge" },
      ],
    },
    {
      id: "neuro",
      title: "Brain, nerves and eyes",
      questions: [
        { id: "neuro", type: "yesno", text: "Over days to weeks, have you had worsening problems with movement, balance, speech, vision, memory or personality?", hint: "If these came on suddenly (face drooping, arm weakness, slurred speech), call emergency services now: that can be a stroke.", short: "worsening problems with movement, speech, vision or thinking" },
        { id: "eye_white", type: "yesno", text: "Does one of the child's pupils look white instead of red in flash photos, or has a new squint appeared?", short: "white pupil in photos", askIf: age("lt", 16) },
      ],
    },
  ];

  // Mole score: NICE's weighted 7-point checklist (rec 1.7.1).
  const moleScore = sections
    .flatMap((s) => s.questions)
    .filter((q) => q.weight)
    .map((q) => [q.id, q.weight]);

  // ------------------------------------------------------------ derived facts
  const derived = {
    child: age("lt", 16),
    cyp: age("lt", 25), // "children and young people" in NG12 means under 25
    adult: age("gte", 18),
    lymph: { any: ["neck_lump", "armpit_lump", "groin_lump", "glands_many"] },
    haematuria_unexplained: { all: ["blood_urine", { f: "uti_link", in: ["no_uti", "persisted", "unsure"] }] },
    lung_symptoms_2: { atLeast: 2, of: ["cough", "fatigue", "breathless", "chest_pain", "weight_loss", "appetite_loss"] },
    lung_symptoms_1: { atLeast: 1, of: ["cough", "fatigue", "breathless", "chest_pain", "weight_loss", "appetite_loss"] },
  };
  const scores = { mole_score: moleScore };

  // -------------------------------------------------------------------- rules
  // urgency: emergency | 48h | 2wk | soon | routine
  // strength: "should" (NICE says refer/offer/do) or "consider"
  // group: rules in the same group are merged in the results (highest urgency wins)
  const rules = [
    // Safety rule, not from NG12
    {
      id: "vomit_blood", source: "nhs", recs: [], group: "vomit_blood",
      cancers: ["Needs urgent care first"],
      when: "vomit_blood", urgency: "emergency", strength: "should",
      action: "NHS advice is to go to A&E or call emergency services if you are vomiting blood. (NG12 rec 1.2.2 separately says doctors should consider an endoscopy to check for oesophageal or stomach cancer.)",
    },

    // 1.1 Lung and pleural
    { id: "1.1.1", recs: ["1.1.1"], group: "chest", cancers: ["Lung cancer"], when: { all: [age("gte", 40), "haemoptysis"] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral (seen within about 2 weeks)." },
    { id: "1.1.2", recs: ["1.1.2"], group: "chest", cancers: ["Lung cancer"], when: { all: [age("gte", 40), { any: ["lung_symptoms_2", { all: ["smoked", "lung_symptoms_1"] }] }] }, urgency: "2wk", strength: "should", action: "Offer an urgent chest X-ray." },
    { id: "1.1.3", recs: ["1.1.3"], group: "chest", cancers: ["Lung cancer"], when: { all: [age("gte", 40), { any: ["chest_infections", "clubbing", "neck_lump"] }] }, urgency: "2wk", strength: "consider", action: "Consider an urgent chest X-ray." },
    { id: "1.1.5", recs: ["1.1.5"], group: "chest", cancers: ["Mesothelioma"], when: { all: [age("gte", 40), { any: ["lung_symptoms_2", { all: [{ any: ["smoked", "asbestos"] }, "lung_symptoms_1"] }] }] }, urgency: "2wk", strength: "should", action: "Offer an urgent chest X-ray." },
    { id: "1.1.6", recs: ["1.1.6"], group: "chest", cancers: ["Mesothelioma"], when: { all: [age("gte", 40), "clubbing"] }, urgency: "2wk", strength: "consider", action: "Consider an urgent chest X-ray." },

    // 1.2 Upper GI
    { id: "1.2.1", recs: ["1.2.1", "1.2.7"], group: "upper_gi", cancers: ["Oesophageal cancer", "Stomach cancer"], when: { any: ["dysphagia", { all: [age("gte", 55), "weight_loss", { any: ["upper_abd_pain", "reflux", "dyspepsia"] }] }] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral." },
    { id: "1.2.3", recs: ["1.2.3", "1.2.9"], group: "upper_gi", cancers: ["Oesophageal cancer", "Stomach cancer"], when: { all: [age("gte", 55), { any: ["dyspepsia_resistant", { all: ["nausea", { any: ["weight_loss", "reflux", "dyspepsia", "upper_abd_pain"] }] }] }] }, urgency: "soon", strength: "consider", action: "Consider a non-urgent endoscopy (camera test of the gullet and stomach)." },
    { id: "1.2.4", recs: ["1.2.4"], group: "pancreas", cancers: ["Pancreatic cancer"], when: { all: [age("gte", 40), "jaundice"] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral." },
    { id: "1.2.5", recs: ["1.2.5"], group: "pancreas", cancers: ["Pancreatic cancer"], when: { all: [age("gte", 60), "weight_loss", { any: ["diarrhoea", "back_pain", "abd_pain", "upper_abd_pain", "nausea", "constipation", "new_diabetes"] }] }, urgency: "2wk", strength: "consider", action: "Consider an urgent CT scan (or ultrasound if CT isn't available)." },
    { id: "1.2.6", recs: ["1.2.6", "1.2.10", "1.2.11"], group: "upper_mass", cancers: ["Stomach cancer", "Liver cancer", "Gall bladder cancer"], when: { all: ["adult", "abd_lump_upper"] }, urgency: "2wk", strength: "consider", action: "A doctor would examine the lump. Depending on what they find, consider a suspected cancer pathway referral (stomach) or an urgent ultrasound (liver, gall bladder)." },

    // 1.3 Lower GI
    {
      id: "1.3.1", recs: ["1.3.1"], group: "colorectal", cancers: ["Bowel (colorectal) cancer"],
      when: { all: ["adult", { any: [
        "abd_lump", "bowel_change",
        { all: [age("gte", 40), "weight_loss", "abd_pain"] },
        { all: [age("lt", 50), "rectal_bleeding", { any: ["abd_pain", "weight_loss"] }] },
        { all: [age("gte", 50), { any: ["rectal_bleeding", "abd_pain", "weight_loss"] }] },
      ] }] },
      urgency: "soon", strength: "should",
      action: "Offer a FIT stool test (checks for hidden blood). A result of 10 µg/g or more leads to a suspected cancer pathway referral (rec 1.3.2). If symptoms continue with a normal result, the referral shouldn't be delayed when there's strong concern (rec 1.3.3).",
    },
    { id: "1.3.6", recs: ["1.3.6"], group: "anal", cancers: ["Anal cancer"], when: "anal_lump", urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },

    // 1.4 Breast
    { id: "1.4.1", recs: ["1.4.1"], group: "breast", cancers: ["Breast cancer"], when: { any: [{ all: [age("gte", 30), "breast_lump"] }, { all: [age("gte", 50), "nipple_change"] }] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral." },
    { id: "1.4.2", recs: ["1.4.2"], group: "breast", cancers: ["Breast cancer"], when: { any: ["breast_skin", { all: [age("gte", 30), "armpit_lump"] }] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },
    { id: "1.4.3", recs: ["1.4.3"], group: "breast", cancers: ["Breast cancer"], when: { all: [age("lt", 30), age("gte", 16), "breast_lump"] }, urgency: "routine", strength: "consider", action: "Consider a non-urgent referral. Breast lumps at this age are rarely cancer." },

    // 1.5 Gynaecological
    { id: "1.5.1", recs: ["1.5.1"], group: "ovarian", cancers: ["Ovarian cancer"], when: { all: [female, "adult", "abd_lump"] }, urgency: "2wk", strength: "should", action: "A doctor would examine you. If they find a pelvic or tummy mass (not obviously fibroids) or fluid in the tummy, refer using a suspected cancer pathway referral." },
    { id: "1.5.2", recs: ["1.5.2", "1.5.6", "1.5.8"], group: "ovarian", cancers: ["Ovarian cancer"], when: { all: [female, "adult", "ovarian_freq"] }, urgency: "soon", strength: "should", action: "Carry out tests: under 40, consider an urgent ultrasound; 40 and over, a CA125 blood test, then an ultrasound if it's above the age threshold." },
    { id: "1.5.5", recs: ["1.5.5"], group: "ovarian", cancers: ["Ovarian cancer"], when: { all: [female, age("gte", 50), "ibs_new"] }, urgency: "soon", strength: "should", action: "Carry out tests for ovarian cancer (CA125 blood test, then ultrasound if needed). IBS rarely starts for the first time at this age." },
    { id: "1.5.3", recs: ["1.5.3"], group: "ovarian", cancers: ["Ovarian cancer"], when: { all: [female, "adult", { any: ["weight_loss", "fatigue", "bowel_change"] }] }, urgency: "soon", strength: "consider", action: "Consider tests for ovarian cancer (CA125 blood test and/or ultrasound)." },
    { id: "1.5.12", recs: ["1.5.12"], group: "endometrial", cancers: ["Womb (endometrial) cancer"], when: { all: [female, age("gte", 55), "pmb", { not: "pmb_hrt" }] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral." },
    { id: "1.5.14", recs: ["1.5.14"], group: "endometrial", cancers: ["Womb (endometrial) cancer"], when: { all: [female, age("lt", 55), "pmb", { not: "pmb_hrt" }] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },
    { id: "1.5.15", recs: ["1.5.15"], group: "endometrial", cancers: ["Womb (endometrial) cancer"], when: { all: [female, "pmb", "pmb_hrt"] }, urgency: "soon", strength: "consider", action: "Unexpected bleeding on HRT should be checked by a doctor. NICE points to British Menopause Society guidance on how to assess it." },
    { id: "1.5.13", recs: ["1.5.13"], group: "endometrial", cancers: ["Womb (endometrial) cancer"], when: { all: [female, age("gte", 55), "vaginal_discharge"] }, urgency: "2wk", strength: "consider", action: "Consider an urgent ultrasound scan." },
    { id: "1.5.17", recs: ["1.5.17"], group: "vulval", cancers: ["Vulval cancer"], when: { all: [female, "vulva"] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },
    { id: "1.5.18", recs: ["1.5.18"], group: "vaginal", cancers: ["Vaginal cancer"], when: { all: [female, "vaginal_lump"] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },

    // 1.6 Urological
    { id: "1.6.2", recs: ["1.6.2", "1.6.3"], group: "prostate", cancers: ["Prostate cancer"], when: { all: [male, "adult", { any: ["luts", "erectile", "blood_urine"] }] }, urgency: "soon", strength: "consider", action: "Consider a PSA blood test and a prostate examination. If PSA is above the threshold for your age, consider a suspected cancer pathway referral." },
    { id: "1.6.4", recs: ["1.6.4", "1.6.6"], group: "bladder_kidney", cancers: ["Bladder cancer", "Kidney (renal) cancer"], when: { all: [age("gte", 45), "haematuria_unexplained"] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral." },
    { id: "1.6.5", recs: ["1.6.5"], group: "bladder_kidney", cancers: ["Bladder cancer"], when: { all: [age("gte", 60), "recurrent_uti"] }, urgency: "routine", strength: "consider", action: "Consider a non-urgent referral." },
    { id: "1.6.7", recs: ["1.6.7"], group: "testicular", cancers: ["Testicular cancer"], when: { all: [male, "testis_change"] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },
    { id: "1.6.8", recs: ["1.6.8"], group: "testicular", cancers: ["Testicular cancer"], when: { all: [male, "testis_other"] }, urgency: "2wk", strength: "consider", action: "Consider an urgent ultrasound scan." },
    { id: "1.6.9", recs: ["1.6.9", "1.6.10"], group: "penile", cancers: ["Penile cancer"], when: { all: [male, "penis"] }, urgency: "2wk", strength: "consider", action: "Once a sexually transmitted infection has been ruled out or treated, consider a suspected cancer pathway referral." },

    // 1.7 Skin
    { id: "1.7.1", recs: ["1.7.1"], group: "melanoma", cancers: ["Melanoma (skin cancer)"], when: { all: ["mole", { f: "mole_score", gte: 3 }] }, urgency: "2wk", strength: "should", action: "Refer using a suspected cancer pathway referral. Your mole scored 3 or more on NICE's weighted 7-point checklist." },
    { id: "1.7.3", recs: ["1.7.3"], group: "melanoma", cancers: ["Melanoma (skin cancer)"], when: "skin_nodule", urgency: "2wk", strength: "consider", action: "A doctor would look at the lump. If it suggests nodular melanoma, consider a suspected cancer pathway referral." },
    { id: "1.7.4", recs: ["1.7.4"], group: "scc", cancers: ["Squamous cell skin cancer"], when: "skin_scaly", urgency: "2wk", strength: "consider", action: "A doctor would look at it. If it raises suspicion of squamous cell carcinoma, consider a suspected cancer pathway referral." },
    { id: "1.7.5", recs: ["1.7.5"], group: "bcc", cancers: ["Basal cell skin cancer"], when: "skin_pearly", urgency: "routine", strength: "consider", action: "A doctor would look at it. If it raises suspicion of basal cell carcinoma, consider a non-urgent referral. These grow slowly." },

    // 1.8 Head and neck
    { id: "1.8.1", recs: ["1.8.1"], group: "larynx", cancers: ["Laryngeal (voice box) cancer"], when: { all: [age("gte", 45), { any: ["hoarseness", "neck_lump"] }] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },
    { id: "1.8.2", recs: ["1.8.2"], group: "oral", cancers: ["Mouth (oral) cancer"], when: { any: ["mouth_ulcer", "neck_lump"] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },
    { id: "1.8.3", recs: ["1.8.3", "1.8.4"], group: "oral", cancers: ["Mouth (oral) cancer"], when: { any: ["mouth_lump", "mouth_patch"] }, urgency: "2wk", strength: "consider", action: "Consider an urgent check by a dentist, who may then refer using a suspected cancer pathway referral." },
    { id: "1.8.5", recs: ["1.8.5"], group: "thyroid", cancers: ["Thyroid cancer"], when: "thyroid_lump", urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral." },

    // 1.9 Brain and CNS
    { id: "1.9.1", recs: ["1.9.1"], group: "brain", cancers: ["Brain or spinal cord tumour"], when: { all: ["adult", "neuro"] }, urgency: "2wk", strength: "consider", action: "Consider an urgent MRI brain scan (or CT if MRI isn't possible)." },
    { id: "1.9.2", recs: ["1.9.2"], group: "brain", cancers: ["Brain or spinal cord tumour"], when: { all: ["cyp", "neuro"] }, urgency: "48h", strength: "consider", action: "Consider a very urgent referral (appointment within 48 hours)." },

    // 1.10 Haematological
    { id: "1.10.1", recs: ["1.10.1"], group: "leukaemia", cancers: ["Leukaemia"], when: { all: ["adult", { any: ["pale", "fatigue", "fever", "infections", "glands_many", "bruising", "bleeding", "petechiae"] }] }, urgency: "48h", strength: "consider", action: "Consider a very urgent full blood count (blood test within 48 hours)." },
    { id: "1.10.2", recs: ["1.10.2"], group: "leukaemia", cancers: ["Leukaemia"], when: { all: ["cyp", "petechiae"] }, urgency: "emergency", strength: "should", action: "Refer for immediate specialist assessment (same day)." },
    { id: "1.10.3", recs: ["1.10.3"], group: "leukaemia", cancers: ["Leukaemia"], when: { all: ["cyp", { any: ["pale", "fatigue", "fever", "infections", "glands_many", "bone_pain", "bruising", "bleeding"] }] }, urgency: "48h", strength: "should", action: "Offer a very urgent full blood count (blood test within 48 hours)." },
    { id: "1.10.4", recs: ["1.10.4", "1.10.5"], group: "myeloma", cancers: ["Myeloma"], when: { all: [age("gte", 60), { any: ["bone_pain", "back_pain", "fracture"] }] }, urgency: "soon", strength: "should", action: "Offer blood tests (full blood count, calcium, ESR or plasma viscosity, and tests for abnormal proteins). Refer using a suspected cancer pathway referral if they suggest myeloma." },
    { id: "1.10.6", recs: ["1.10.6", "1.10.8"], group: "lymphoma", cancers: ["Non-Hodgkin lymphoma", "Hodgkin lymphoma"], when: { all: ["adult", "lymph"] }, urgency: "2wk", strength: "consider", action: "Consider a suspected cancer pathway referral, especially alongside fever, night sweats, shortness of breath, itching or weight loss.", alsoNote: ["fever", "night_sweats", "breathless", "itching", "weight_loss"] },
    { id: "1.10.7", recs: ["1.10.7", "1.10.9"], group: "lymphoma", cancers: ["Non-Hodgkin lymphoma", "Hodgkin lymphoma"], when: { all: ["cyp", "lymph"] }, urgency: "48h", strength: "consider", action: "Consider a very urgent referral (appointment within 48 hours), especially alongside fever, night sweats, shortness of breath, itching or weight loss.", alsoNote: ["fever", "night_sweats", "breathless", "itching", "weight_loss"] },

    // 1.11 Sarcomas
    { id: "1.11.3", recs: ["1.11.3", "1.11.2"], group: "bone_sarcoma", cancers: ["Bone sarcoma"], when: { all: ["cyp", { any: ["bone_swelling", "bone_pain"] }] }, urgency: "48h", strength: "consider", action: "Consider a very urgent X-ray (within 48 hours). If the X-ray suggests bone sarcoma, consider a very urgent referral." },
    { id: "1.11.4", recs: ["1.11.4", "1.11.5"], group: "soft_sarcoma", cancers: ["Soft tissue sarcoma"], when: { all: ["adult", "growing_lump"] }, urgency: "2wk", strength: "consider", action: "Consider an urgent ultrasound scan." },
    { id: "1.11.6", recs: ["1.11.6", "1.11.7"], group: "soft_sarcoma", cancers: ["Soft tissue sarcoma"], when: { all: ["cyp", "growing_lump"] }, urgency: "48h", strength: "consider", action: "Consider a very urgent ultrasound scan (within 48 hours)." },

    // 1.12 Childhood
    { id: "1.12.1", recs: ["1.12.1", "1.12.3"], group: "child_abdo", cancers: ["Neuroblastoma", "Wilms' tumour"], when: { all: ["child", "abd_lump"] }, urgency: "48h", strength: "consider", action: "Consider a very urgent referral for specialist assessment (within 48 hours)." },
    { id: "1.12.3", recs: ["1.12.3"], group: "child_abdo", cancers: ["Wilms' tumour"], when: { all: ["child", "blood_urine"] }, urgency: "48h", strength: "consider", action: "Consider a very urgent referral for specialist assessment (within 48 hours)." },
    { id: "1.12.2", recs: ["1.12.2"], group: "retinoblastoma", cancers: ["Retinoblastoma (eye cancer)"], when: { all: ["child", "eye_white"] }, urgency: "2wk", strength: "consider", action: "Consider an eye specialist referral using a suspected cancer pathway referral." },

    // 1.13 Non-site-specific
    { id: "1.13.2", recs: ["1.13.2"], group: "nonspecific_weight", cancers: ["Several cancers (bowel, gullet and stomach, lung, prostate, pancreas, urinary)"], when: { all: [age("gte", 60), "weight_loss_5pct"] }, urgency: "2wk", strength: "should", action: "Assess for other symptoms to narrow it down, and offer urgent tests or a referral." },
    { id: "1.13.3", recs: ["1.13.3"], group: "nonspecific_appetite", cancers: ["Several cancers (lung, gullet, stomach, bowel, pancreas, bladder, kidney)"], when: { all: ["adult", "appetite_loss"] }, urgency: "2wk", strength: "should", action: "Assess for other symptoms to narrow it down, and offer urgent tests or a referral." },
    { id: "1.13.4", recs: ["1.13.4"], group: "nonspecific_dvt", cancers: ["Several cancers (urogenital, breast, bowel, lung)"], when: "dvt", urgency: "2wk", strength: "consider", action: "Assess for other symptoms, and consider urgent tests or a referral." },
  ];

  const urgencyLevels = {
    emergency: { rank: 5, label: "Get help today", detail: "Go to an emergency department or call emergency services." },
    "48h": { rank: 4, label: "See a doctor within 48 hours", detail: "Contact your doctor today and say it's urgent." },
    "2wk": { rank: 3, label: "See a doctor within 2 weeks", detail: "Book an urgent appointment and mention these symptoms." },
    soon: { rank: 2, label: "Book a doctor's appointment soon", detail: "A simple test is usually the first step." },
    routine: { rank: 1, label: "Mention it at a routine appointment", detail: "Not urgent, but worth getting checked." },
  };

  const KB = { SOURCE_URL, sections, derived, scores, rules, urgencyLevels, updated: "15 April 2026" };
  if (typeof module !== "undefined" && module.exports) module.exports = KB;
  else root.KB = KB;
})(typeof window !== "undefined" ? window : globalThis);
