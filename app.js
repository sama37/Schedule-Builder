/* ============================================================
   Class Schedule Builder — app.js
   All application logic and DOM rendering lives here.
   No framework needed — plain JavaScript!
   ============================================================ */

// ─── Constants ───────────────────────────────────────────────
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const dayToIdx  = Object.fromEntries(DAY_ORDER.map((d, i) => [d, i]));

// ─── Utility helpers ─────────────────────────────────────────
function timeToMinutes(t) {
  if (t === "" || t == null) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(mins) {
  if (mins == null) return "";
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return h + ":" + m;
}

// 12-hour format for display (e.g. 9:00 AM, 1:30 PM)
function minutesToTime12(mins) {
  if (mins == null) return "";
  const totalH = Math.floor(mins / 60);
  const m      = String(mins % 60).padStart(2, "0");
  const ampm   = totalH >= 12 ? "PM" : "AM";
  const h      = totalH % 12 === 0 ? 12 : totalH % 12;
  return h + ":" + m + " " + ampm;
}

// Parse user-typed time like "9:00 AM", "9:00am", "9am", "13:00" -> minutes
function parseTime12(str) {
  if (!str) return null;
  str = str.trim().toUpperCase();
  // Try 24-hour format first: 13:00
  let m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1]), min = parseInt(m[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }
  // 12-hour with AM/PM: 9:00 AM, 9:00AM, 9AM, 9 AM
  m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (m) {
    let h = parseInt(m[1]), min = m[2] ? parseInt(m[2]) : 0;
    if (m[3] === "AM" && h === 12) h = 0;
    if (m[3] === "PM" && h !== 12) h += 12;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }
  return null;
}

function rangesOverlap(aS, aE, bS, bE) { return aS < bE && bS < aE; }

function meetsConflict(a, b) {
  for (const d of a.days)
    if (b.days.includes(d) && rangesOverlap(a.start, a.end, b.start, b.end)) return true;
  return false;
}

function scheduleConflicts(blocks) {
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++)
      if (meetsConflict(blocks[i], blocks[j])) return true;
  return false;
}

function computeGapsScore(blocks) {
  const byDay = new Map();
  blocks.forEach(s => (s.days || []).forEach(d => {
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push([s.start, s.end]);
  }));
  let idle = 0;
  byDay.forEach(ranges => {
    ranges.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++)
      idle += Math.max(0, ranges[i][0] - ranges[i - 1][1]);
  });
  return idle;
}

function rid() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()); }
}

function isAsyncMeeting(m)    { return m && (m.async === true || m.mode === "Online async"); }
function isValidTimedMeeting(m) {
  if (isAsyncMeeting(m)) return false;
  if (!m.days || m.days.length === 0) return false;
  if (m.start == null || m.end == null) return false;
  if (m.end <= m.start) return false;
  return true;
}

function cartesian(arrays) {
  if (!arrays || arrays.length === 0) return [];
  return arrays.reduce((acc, cur) => {
    const out = [];
    for (const a of acc) for (const b of cur) out.push(a.concat([b]));
    return out;
  }, [[]]);
}

// ─── Factory helpers ─────────────────────────────────────────
function makeCourse(obj = {}) {
  const { code = "", name = "", credits = 3, required = false, priority = 3, sections = [] } = obj;
  return { id: rid(), code, name, credits, required, priority, sections };
}
function makeSection(label) { return { id: rid(), label: label || "001", meetings: [] }; }
function makeMeeting()      { return { id: rid(), title: "Lecture", days: [], start: null, end: null, location: "Building / Room", mode: "In-person", async: false }; }

// ─── localStorage helpers ────────────────────────────────────
function getLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function setLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Default example data ────────────────────────────────────
const DEFAULT_EXAMPLE = [
  makeCourse({ code: "MTH-101", name: "College Algebra", credits: 3, required: true, priority: 5, sections: [
    { id: rid(), label: "001", meetings: [
      { id: rid(), title: "Lecture",    days: ["Mon","Wed"], start: 540, end: 615, location: "Wells Hall A216", mode: "In-person", async: false },
      { id: rid(), title: "Recitation", days: ["Fri"],       start: 600, end: 650, location: "Bessey 110",      mode: "In-person", async: false },
    ]},
    { id: rid(), label: "002", meetings: [
      { id: rid(), title: "Lecture",    days: ["Tue","Thu"], start: 660, end: 735, location: "Wells Hall A216", mode: "In-person", async: false },
      { id: rid(), title: "Recitation", days: ["Fri"],       start: 780, end: 830, location: "Bessey 110",      mode: "In-person", async: false },
    ]},
  ]}),
  makeCourse({ code: "ENG-201", name: "Writing & Rhetoric", credits: 3, required: false, priority: 3, sections: [
    { id: rid(), label: "003", meetings: [{ id: rid(), title: "Lecture", days: ["Mon","Wed"], start: 630, end: 705, location: "Online", mode: "Online sync", async: false }]},
    { id: rid(), label: "004", meetings: [{ id: rid(), title: "Lecture", days: [], start: null, end: null, location: "Online", mode: "Online async", async: true  }]},
  ]}),
  makeCourse({ code: "CIS-150", name: "Intro to Programming", credits: 4, required: true, priority: 4, sections: [
    { id: rid(), label: "A", meetings: [
      { id: rid(), title: "Lecture", days: ["Tue","Thu"], start: 540, end: 620, location: "Engineering 120", mode: "In-person", async: false },
      { id: rid(), title: "Lab",     days: ["Thu"],       start: 840, end: 950, location: "Computer Lab 2",  mode: "In-person", async: false },
    ]},
    { id: rid(), label: "B", meetings: [
      { id: rid(), title: "Lecture", days: ["Mon","Wed"], start: 780, end: 860, location: "Engineering 120", mode: "In-person", async: false },
      { id: rid(), title: "Lab",     days: ["Wed"],       start: 900, end: 1010, location: "Computer Lab 3", mode: "In-person", async: false },
    ]},
  ]}),
  makeCourse({ code: "SOC-110", name: "Intro Sociology", credits: 3, required: false, priority: 2, sections: [
    { id: rid(), label: "A", meetings: [{ id: rid(), title: "Lecture", days: ["Mon","Wed","Fri"], start: 840, end: 890, location: "Wells Hall B101", mode: "In-person", async: false }]}
  ]}),
];

// ─── App state ───────────────────────────────────────────────
let state = {
  courses:      getLS("csb.courses.v6", DEFAULT_EXAMPLE),
  maxSchedules: getLS("csb.max.v1", 50),
  includeOpt:   getLS("csb.opt.v1", true),
  minCredits:   getLS("csb.minCred.v1", 12),
  maxCredits:   getLS("csb.maxCred.v1", 18),
  blockedDays:  getLS("csb.blockDays.v1", []),
  earliestStart:getLS("csb.earliest.v1", 8 * 60),
  latestEnd:    getLS("csb.latest.v1", 18 * 60),
  minGap:       getLS("csb.minGap.v1", 10),
  travelPenalty:getLS("csb.travelPenalty.v1", 15),
  generated:    [],
  ranOnce:      false,
  page:         'builder', // 'builder' or 'results'
};

function saveState() {
  setLS("csb.courses.v6",     state.courses);
  setLS("csb.max.v1",         state.maxSchedules);
  setLS("csb.opt.v1",         state.includeOpt);
  setLS("csb.minCred.v1",     state.minCredits);
  setLS("csb.maxCred.v1",     state.maxCredits);
  setLS("csb.blockDays.v1",   state.blockedDays);
  setLS("csb.earliest.v1",    state.earliestStart);
  setLS("csb.latest.v1",      state.latestEnd);
  setLS("csb.minGap.v1",      state.minGap);
  setLS("csb.travelPenalty.v1", state.travelPenalty);
}

// ─── Schedule generation helpers ────────────────────────────
function requiresTravel(a, b) {
  return a.mode === "In-person" && b.mode === "In-person"
    && a.location && b.location && a.location !== b.location;
}
function requiredGapMins(a, b) {
  return Number(state.minGap) || 0;
}
function meetingBlocked(m) {
  if (isAsyncMeeting(m)) return false;
  if (!isValidTimedMeeting(m)) return true;
  if ((m.days || []).some(d => state.blockedDays.includes(d))) return true;
  if (state.earliestStart != null && m.start < state.earliestStart) return true;
  if (state.latestEnd    != null && m.end   > state.latestEnd)    return true;
  return false;
}
function sectionBlocked(sec) { return (sec.meetings || []).some(m => meetingBlocked(m)); }
function violatesGapRule(blocks) {
  const byDay = new Map();
  blocks.forEach(s => (s.days || []).forEach(d => {
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(s);
  }));
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.start - b.start);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].start - arr[i - 1].end < requiredGapMins(arr[i - 1], arr[i])) return true;
    }
  }
  return false;
}

function generateSchedules() {
  state.ranOnce = true;
  const cleaned = state.courses.filter(c => c.sections && c.sections.length > 0 && c.sections.every(s => s.meetings.length > 0));
  const req = cleaned.filter(c => c.required);
  const opt = cleaned.filter(c => !c.required);
  const base = req.length > 0 ? req : opt;
  if (base.length === 0) { state.generated = []; return; }

  const bundles = base.map(c =>
    c.sections.filter(sec => !sectionBlocked(sec)).map(sec => ({
      course: c, section: sec,
      blocks: sec.meetings.filter(isValidTimedMeeting).map(m => Object.assign({}, m, { course: c, sectionLabel: sec.label }))
    }))
  );
  if (bundles.some(b => b.length === 0)) { state.generated = []; return; }

  const combos  = cartesian(bundles);
  const results = [];
  const hardMax = Math.max(50, Number(state.maxSchedules)) * 5;
  const minC = Number(state.minCredits) || 0;
  const maxC = Number(state.maxCredits) || 999;

  for (const combo of combos) {
    const baseBlocks   = combo.reduce((acc, b) => acc.concat(b.blocks), []);
    if (scheduleConflicts(baseBlocks)) continue;
    if (violatesGapRule(baseBlocks))   continue;
    const selectedBase = combo.map(b => ({ course: b.course, section: b.section }));
    const baseCredits  = selectedBase.reduce((acc, s) => acc + (s.course.credits || 0), 0);

    if (!state.includeOpt) {
      if (baseCredits >= minC && baseCredits <= maxC) {
        const score = selectedBase.reduce((acc, s) => acc + (s.course.priority || 0), 0);
        results.push({ id: rid(), chosen: baseBlocks, score, gaps: computeGapsScore(baseBlocks), creditTotal: baseCredits, selectedSections: selectedBase });
      }
      continue;
    }

    const sortedOpt = opt.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const collector = [];

    (function dfs(i, blocks, sections, credits) {
      if (credits >= minC && credits <= maxC) collector.push({ blocks: blocks.slice(), sections: sections.slice(), credits });
      if (i >= sortedOpt.length || collector.length >= hardMax) return;
      dfs(i + 1, blocks, sections, credits);
      const c = sortedOpt[i];
      const bForC = c.sections.filter(sec => !sectionBlocked(sec)).map(sec => ({
        course: c, section: sec,
        blocks: sec.meetings.filter(isValidTimedMeeting).map(m => Object.assign({}, m, { course: c, sectionLabel: sec.label }))
      }));
      for (const bndl of bForC) {
        const nc = credits + (c.credits || 0);
        if (nc > maxC) continue;
        const cand = blocks.concat(bndl.blocks);
        if (scheduleConflicts(cand) || violatesGapRule(cand)) continue;
        sections.push({ course: c, section: bndl.section });
        if (collector.length < hardMax) dfs(i + 1, cand, sections, nc);
        sections.pop();
        if (collector.length >= hardMax) break;
      }
    })(0, baseBlocks.slice(), selectedBase.slice(), baseCredits);

    for (const c of collector) {
      const score = c.sections.reduce((acc, s) => acc + (s.course.priority || 0), 0);
      results.push({ id: rid(), chosen: c.blocks, score, gaps: computeGapsScore(c.blocks), creditTotal: c.credits, selectedSections: c.sections });
      if (results.length >= hardMax) break;
    }
    if (results.length >= hardMax) break;
  }

  results.sort((a, b) => (b.score - a.score) || (a.gaps - b.gaps) || (b.creditTotal - a.creditTotal));
  state.generated = results.slice(0, Number(state.maxSchedules) || 50);
}

// ─── DOM rendering helpers ───────────────────────────────────
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function inputEl(type, value, className, onChange) {
  const i = document.createElement("input");
  i.type  = type;
  i.value = value != null ? value : "";
  if (className) i.className = "input " + className;
  i.addEventListener(type === "checkbox" ? "change" : "input", onChange);
  return i;
}

function selectEl(options, value, onChange) {
  const s = document.createElement("select");
  s.className = "select";
  options.forEach(o => {
    const opt    = document.createElement("option");
    opt.value    = o;
    opt.textContent = o;
    if (o === value) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener("change", onChange);
  return s;
}

function labelWrap(labelText, inputEl) {
  const wrap = el("div");
  wrap.appendChild(el("label", "field-label", labelText));
  wrap.appendChild(inputEl);
  return wrap;
}

function dayPickerEl(value, onChange, disabled) {
  const wrap = el("div", "day-picker" + (disabled ? " disabled" : ""));
  DAY_ORDER.forEach(d => {
    const btn = el("button", "day-btn" + (value.includes(d) ? " active" : ""), d);
    btn.type = "button";
    btn.onclick = () => {
      if (disabled) return;
      const next = value.includes(d) ? value.filter(x => x !== d) : value.concat([d]).sort((a, b) => dayToIdx[a] - dayToIdx[b]);
      onChange(next);
    };
    wrap.appendChild(btn);
  });
  return wrap;
}

// ─── Meeting row ─────────────────────────────────────────────
function renderMeetingRow(cid, sid, m) {
  const row  = el("div", "meeting-row");
  const async = isAsyncMeeting(m);

  function update(u) {
    const c  = state.courses.find(x => x.id === cid);
    const s  = c.sections.find(x => x.id === sid);
    const mi = s.meetings.find(x => x.id === m.id);
    Object.assign(mi, u);
    Object.assign(m, u);
    saveState();
    render();
  }

  row.appendChild(labelWrap("Title", inputEl("text", m.title, "input-md", e => update({ title: e.target.value }))));

  // Async checkbox
  const asyncWrap = el("div");
  asyncWrap.appendChild(el("label", "field-label", "Async (no time)"));
  const asyncCb = document.createElement("input");
  asyncCb.type  = "checkbox";
  asyncCb.className = "cb";
  asyncCb.checked   = async;
  asyncCb.onchange  = e => {
    if (e.target.checked) update({ async: true, mode: "Online async", days: [], start: null, end: null });
    else                  update({ async: false, mode: "In-person" });
  };
  asyncWrap.appendChild(asyncCb);
  row.appendChild(asyncWrap);

  row.appendChild(labelWrap("Days", dayPickerEl(m.days || [], days => update({ days }), async)));
  const startInp = document.createElement("input");
  startInp.type = "text"; startInp.className = "input"; startInp.placeholder = "e.g. 9:00 AM";
  startInp.value = m.start != null ? minutesToTime12(m.start) : "";
  if (async) startInp.disabled = true;
  startInp.addEventListener("blur", e => {
    if (async) return;
    const parsed = parseTime12(e.target.value);
    if (parsed !== null) { e.target.value = minutesToTime12(parsed); update({ start: parsed }); }
    else { e.target.style.borderColor = "#ef4444"; }
  });
  startInp.addEventListener("focus", e => { e.target.style.borderColor = ""; });
  row.appendChild(labelWrap("Start (e.g. 9:00 AM)", startInp));

  const endInp = document.createElement("input");
  endInp.type = "text"; endInp.className = "input"; endInp.placeholder = "e.g. 10:30 AM";
  endInp.value = m.end != null ? minutesToTime12(m.end) : "";
  if (async) endInp.disabled = true;
  endInp.addEventListener("blur", e => {
    if (async) return;
    const parsed = parseTime12(e.target.value);
    if (parsed !== null) { e.target.value = minutesToTime12(parsed); update({ end: parsed }); }
    else { e.target.style.borderColor = "#ef4444"; }
  });
  endInp.addEventListener("focus", e => { e.target.style.borderColor = ""; });
  row.appendChild(labelWrap("End (e.g. 10:30 AM)", endInp));
  row.appendChild(labelWrap("Location", inputEl("text", m.location, "input-md", e => update({ location: e.target.value }))));
  row.appendChild(labelWrap("Mode", selectEl(["In-person","Online sync","Online async"], m.mode, e => update({ mode: e.target.value }))));

  const removeBtn = el("button", "btn btn-danger ml-auto", "Remove");
  removeBtn.onclick = () => {
    const c = state.courses.find(x => x.id === cid);
    const s = c.sections.find(x => x.id === sid);
    s.meetings = s.meetings.filter(x => x.id !== m.id);
    saveState(); render();
  };
  row.appendChild(removeBtn);
  return row;
}

// ─── Section card ────────────────────────────────────────────
function renderSectionCard(cid, sec) {
  const card = el("div", "section-card");

  const topRow = el("div", "flex items-center gap-3");
  topRow.appendChild(labelWrap("Section label", inputEl("text", sec.label, "input-sm", e => {
    const c = state.courses.find(x => x.id === cid);
    const s = c.sections.find(x => x.id === sec.id);
    s.label = e.target.value;
    saveState(); render();
  })));
  const removeSecBtn = el("button", "btn btn-danger", "Remove section");
  removeSecBtn.onclick = () => {
    const c = state.courses.find(x => x.id === cid);
    c.sections = c.sections.filter(x => x.id !== sec.id);
    saveState(); render();
  };
  topRow.appendChild(removeSecBtn);
  card.appendChild(topRow);

  const meetingsHead = el("div", "section-title mt-3");
  meetingsHead.appendChild(el("h4", "font-medium", `Meetings (${sec.meetings.length})`));
  const addMeetBtn = el("button", "btn btn-dark", "Add meeting");
  addMeetBtn.onclick = () => {
    const c = state.courses.find(x => x.id === cid);
    const s = c.sections.find(x => x.id === sec.id);
    s.meetings.push(makeMeeting());
    saveState(); render();
  };
  meetingsHead.appendChild(addMeetBtn);
  card.appendChild(meetingsHead);

  if (sec.meetings.length === 0) {
    card.appendChild(el("p", "text-sm text-slate mt-2", "Add the lecture/lab/recitation times for this section."));
  } else {
    sec.meetings.forEach(m => card.appendChild(renderMeetingRow(cid, sec.id, m)));
  }
  return card;
}

// ─── Course card ─────────────────────────────────────────────
function renderCourseCard(c) {
  const card = el("div", "card");

  // Top row: code, name, credits, required, priority, remove
  const topRow = el("div", "flex flex-wrap items-end gap-3");

  topRow.appendChild(labelWrap("Course code",
    inputEl("text", c.code, "input-md", e => { c.code = e.target.value; saveState(); })
  ));
  const nameInp = inputEl("text", c.name, "input-full", e => { c.name = e.target.value; saveState(); });
  nameInp.placeholder = "Optional title";
  const nameFlex = el("div"); nameFlex.style.flex = "1"; nameFlex.style.minWidth = "12rem";
  nameFlex.appendChild(el("label", "field-label", "Course name"));
  nameFlex.appendChild(nameInp);
  topRow.appendChild(nameFlex);

  topRow.appendChild(labelWrap("Credits", inputEl("number", c.credits, "input-sm", e => { c.credits = Number(e.target.value); saveState(); })));

  const reqLabel = document.createElement("label");
  reqLabel.className = "checkbox-label";
  const reqCb = document.createElement("input");
  reqCb.type = "checkbox"; reqCb.className = "cb"; reqCb.checked = !!c.required;
  reqCb.onchange = e => { c.required = e.target.checked; saveState(); render(); };
  reqLabel.appendChild(reqCb); reqLabel.appendChild(document.createTextNode("Required this term"));
  topRow.appendChild(reqLabel);

  const priInp = inputEl("number", c.priority, "input-sm", e => {
    c.priority = Math.min(5, Math.max(1, Number(e.target.value))); saveState();
  });
  priInp.min = 1; priInp.max = 5;
  topRow.appendChild(labelWrap("Priority (1–5)", priInp));

  const removeBtn = el("button", "btn btn-danger ml-auto", "Remove course");
  removeBtn.onclick = () => { state.courses = state.courses.filter(x => x.id !== c.id); saveState(); render(); };
  topRow.appendChild(removeBtn);
  card.appendChild(topRow);

  // Sections
  const secHead = el("div", "section-title mt-4");
  secHead.appendChild(el("h3", "font-semibold", "Sections (pick one)"));
  const addSecBtn = el("button", "btn btn-dark", "Add section");
  addSecBtn.onclick = () => {
    c.sections.push(makeSection(String(c.sections.length + 1).padStart(3, "0")));
    saveState(); render();
  };
  secHead.appendChild(addSecBtn);
  card.appendChild(secHead);

  if (c.sections.length === 0) {
    card.appendChild(el("p", "text-sm text-slate mt-2", "Add each official registration section (e.g., 001, 002)."));
  } else {
    c.sections.forEach(s => card.appendChild(renderSectionCard(c.id, s)));
  }
  return card;
}

// ─── Mini calendar grid ──────────────────────────────────────
function renderMiniGrid(blocks) {
  const START = 8 * 60, END = 18 * 60, TOTAL = END - START;
  const COL_PX = 600; // must match .mini-day-col height in CSS

  const grid = el("div", "mini-grid");
  grid.appendChild(el("div"));
  DAY_ORDER.forEach(d => grid.appendChild(el("div", "mini-grid-header", d)));

  const timeCol = el("div", "mini-time-col");
  [8, 10, 12, 14, 16, 18].forEach(h => timeCol.appendChild(el("div", "", minutesToTime12(h * 60))));
  grid.appendChild(timeCol);

  DAY_ORDER.forEach(d => {
    const col = el("div", "mini-day-col");
    (blocks || []).forEach((s) => {
      if (!(s.days || []).includes(d)) return;
      const topPx    = ((s.start - START) / TOTAL) * COL_PX;
      const heightPx = Math.max(((s.end - s.start) / TOTAL) * COL_PX, 32); // min 32px so short blocks show
      const block    = el("div", "mini-block");
      block.style.top    = topPx + "px";
      block.style.height = heightPx + "px";
      block.title = `${s.course?.code || ""} ${s.course?.name || ""} (${s.sectionLabel}) — ${s.title} ${minutesToTime12(s.start)}-${minutesToTime12(s.end)} @ ${s.location} (${s.mode})`;
      block.appendChild(el("div", "mini-block-title", `${s.course?.code || ""} ${s.sectionLabel}`));
      block.appendChild(el("div", "mini-block-sub",  `${s.title} · ${s.location}`));
      block.appendChild(el("div", "mini-block-time", `${minutesToTime12(s.start)}-${minutesToTime12(s.end)}`));
      col.appendChild(block);
    });
    grid.appendChild(col);
  });
  return grid;
}

// ─── Result card helpers ─────────────────────────────────────
function computeScheduleStats(result) {
  // Days with classes
  const daysWithClass = new Set();
  result.chosen.forEach(b => (b.days || []).forEach(d => daysWithClass.add(d)));

  // Earliest start and latest end across all blocks
  let earliest = Infinity, latest = -Infinity;
  result.chosen.forEach(b => {
    if (b.start < earliest) earliest = b.start;
    if (b.end   > latest)   latest   = b.end;
  });

  // Wait time per day (gaps between consecutive classes)
  const byDay = new Map();
  result.chosen.forEach(b => (b.days || []).forEach(d => {
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(b);
  }));
  const waitByDay = {};
  byDay.forEach((blocks, d) => {
    blocks.sort((a, b) => a.start - b.start);
    let wait = 0;
    for (let i = 1; i < blocks.length; i++)
      wait += Math.max(0, blocks[i].start - blocks[i-1].end);
    waitByDay[d] = wait;
  });

  return { daysWithClass, earliest, latest, waitByDay };
}

// ─── Result card ─────────────────────────────────────────────
function renderResultCard(result, idx) {
  const card = el("div", "result-card");
  let expanded = false;

  const stats = computeScheduleStats(result);

  // ── Header bar ──
  const header = el("div", "result-header");
  const headerLeft = el("div", "result-header-left");
  headerLeft.appendChild(el("span", "result-option-label", `Option ${idx + 1}`));

  // Stat pills
  const pills = el("div", "result-pills");
  function pill(icon, value, title) {
    const p = el("div", "result-pill");
    p.title = title;
    p.appendChild(el("span", "pill-icon", icon));
    p.appendChild(el("span", "pill-value", value));
    return p;
  }
  pills.appendChild(pill("📚", `${result.creditTotal} credits`, "Total credits"));
  pills.appendChild(pill("📅", `${stats.daysWithClass.size} day${stats.daysWithClass.size !== 1 ? "s" : ""}/week`, "Days on campus per week"));
  pills.appendChild(pill("⏰", stats.earliest !== Infinity ? minutesToTime12(stats.earliest) : "—", "Earliest class start"));
  pills.appendChild(pill("🏁", stats.latest !== -Infinity ? minutesToTime12(stats.latest) : "—", "Latest class end"));

  headerLeft.appendChild(pills);
  header.appendChild(headerLeft);

  const detailsBtn = el("button", "btn btn-details", "View Details ▾");
  detailsBtn.onclick = () => {
    expanded = !expanded;
    detailsBtn.textContent = expanded ? "Hide Details ▴" : "View Details ▾";
    detailsPanel.style.display = expanded ? "block" : "none";
  };
  header.appendChild(detailsBtn);
  card.appendChild(header);

  // ── Preview body (always visible) ──
  const body = el("div", "result-body");
  body.appendChild(renderMiniGrid(result.chosen));
  card.appendChild(body);

  // ── Expandable details panel ──
  const detailsPanel = el("div", "details-panel");
  detailsPanel.style.display = "none";

  // Wait time per day section
  const waitSection = el("div", "details-section");
  waitSection.appendChild(el("h4", "details-section-title", "⏱ Time Between Classes"));
  const waitGrid = el("div", "wait-grid");
  DAY_ORDER.forEach(d => {
    if (!stats.daysWithClass.has(d)) return;
    const mins = stats.waitByDay[d] || 0;
    const item = el("div", "wait-item");
    item.appendChild(el("span", "wait-day", d));
    if (mins === 0) {
      item.appendChild(el("span", "wait-value wait-none", "No gaps"));
    } else {
      const h = Math.floor(mins / 60), m = mins % 60;
      const label = h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}` : `${m}m`;
      item.appendChild(el("span", "wait-value", label + " waiting"));
    }
    waitGrid.appendChild(item);
  });
  waitSection.appendChild(waitGrid);
  detailsPanel.appendChild(waitSection);

  // Course breakdown
  const courseSection = el("div", "details-section");
  courseSection.appendChild(el("h4", "details-section-title", "📋 Course Breakdown"));

  (result.selectedSections || []).forEach(sel => {
    const courseCard = el("div", "course-detail-card");

    const courseTop = el("div", "course-detail-top");
    const badge = el("span", "badge " + (sel.course.required ? "badge-required" : "badge-optional"),
      sel.course.required ? "Required" : "Optional");
    const nameWrap = el("div", "course-detail-name");
    nameWrap.appendChild(el("span", "course-detail-code", sel.course.code));
    nameWrap.appendChild(el("span", "course-detail-title", sel.course.name));
    const credSpan = el("span", "course-detail-credits", sel.course.credits + " credits");
    courseTop.appendChild(badge);
    courseTop.appendChild(nameWrap);
    courseTop.appendChild(credSpan);
    courseCard.appendChild(courseTop);

    const secLabel = el("div", "course-detail-section", `Section ${sel.section.label}`);
    courseCard.appendChild(secLabel);

    const meetList = el("div", "course-detail-meetings");
    (sel.section.meetings || []).forEach(m => {
      const row = el("div", "meeting-detail-row");
      if (isAsyncMeeting(m)) {
        row.appendChild(el("span", "meeting-detail-type", m.title || "Meeting"));
        row.appendChild(el("span", "meeting-detail-async", "Online — Async (no set time)"));
      } else {
        row.appendChild(el("span", "meeting-detail-type", m.title || "Meeting"));
        const info = el("span", "meeting-detail-info");
        info.textContent = `${(m.days || []).join(", ")}  •  ${minutesToTime12(m.start)} – ${minutesToTime12(m.end)}  •  ${m.location}`;
        row.appendChild(info);
        const modeBadge = el("span", "meeting-mode-badge " + (m.mode === "In-person" ? "mode-inperson" : "mode-online"), m.mode);
        row.appendChild(modeBadge);
      }
      meetList.appendChild(row);
    });
    courseCard.appendChild(meetList);
    courseSection.appendChild(courseCard);
  });

  detailsPanel.appendChild(courseSection);
  card.appendChild(detailsPanel);

  return card;
}

// ─── Generate panel ──────────────────────────────────────────
function renderGeneratePanel(container) {
  const panel = el("div", "generate-panel");
  panel.appendChild(el("h2", "font-semibold text-sm", "Generate Schedules"));

  // Filters box
  const filters = el("div", "filters-box");
  filters.appendChild(el("h3", "font-medium text-sm", "Filters"));

  const grid = el("div", "filters-grid text-sm");

  function filterNum(label, key, width) {
    const row = el("label", "filter-row");
    row.appendChild(el("span", "", label));
    const inp = inputEl("number", state[key], "input-sm", e => {
      state[key] = Number(e.target.value); saveState();
    });
    row.appendChild(inp); grid.appendChild(row);
  }
  function filterTime(label, key) {
    const row = el("div", "filter-row");
    row.appendChild(el("span", "", label));
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "input input-sm";
    inp.placeholder = "e.g. 8:00 AM";
    inp.value = state[key] != null ? minutesToTime12(state[key]) : "";
    inp.addEventListener("blur", e => {
      const parsed = parseTime12(e.target.value);
      if (parsed !== null) { e.target.value = minutesToTime12(parsed); state[key] = parsed; saveState(); }
      else { e.target.style.borderColor = "#ef4444"; }
    });
    inp.addEventListener("focus", e => { e.target.style.borderColor = ""; });
    row.appendChild(inp);
    grid.appendChild(row);
  }

  filterNum("Min credits", "minCredits");
  filterNum("Max credits", "maxCredits");

  const daysWrap = el("div", "col-span-2");
  daysWrap.appendChild(el("div", "text-xs text-slate mb-2", "Days to avoid"));
  daysWrap.appendChild(dayPickerEl(state.blockedDays, days => { state.blockedDays = days; saveState(); render(); }));
  grid.appendChild(daysWrap);

  filterTime("Earliest start", "earliestStart");
  filterTime("Latest end",     "latestEnd");
  filterNum("Time between classes (minutes)", "minGap");

  const noFriLabel = document.createElement("label");
  noFriLabel.className = "checkbox-label col-span-2";
  const noFriCb = document.createElement("input");
  noFriCb.type = "checkbox"; noFriCb.className = "cb"; noFriCb.checked = state.blockedDays.includes("Fri");
  noFriCb.onchange = e => {
    state.blockedDays = e.target.checked
      ? Array.from(new Set(state.blockedDays.concat(["Fri"]))).sort((a,b)=>dayToIdx[a]-dayToIdx[b])
      : state.blockedDays.filter(x => x !== "Fri");
    saveState(); render();
  };
  noFriLabel.appendChild(noFriCb); noFriLabel.appendChild(document.createTextNode("No Friday classes"));
  grid.appendChild(noFriLabel);

  filters.appendChild(grid);
  panel.appendChild(filters);

  // Max results + include optional
  const optRow = el("div", "filters-grid text-sm");
  const maxRow = el("label", "filter-row");
  maxRow.appendChild(el("span", "", "Max results"));
  maxRow.appendChild(inputEl("number", state.maxSchedules, "input-sm", e => { state.maxSchedules = Number(e.target.value); saveState(); }));
  optRow.appendChild(maxRow);

  const optLabel = document.createElement("label");
  optLabel.className = "checkbox-label";
  const optCb = document.createElement("input");
  optCb.type = "checkbox"; optCb.className = "cb"; optCb.checked = !!state.includeOpt;
  optCb.onchange = e => { state.includeOpt = e.target.checked; saveState(); };
  optLabel.appendChild(optCb); optLabel.appendChild(document.createTextNode("Include optional courses"));
  optRow.appendChild(optLabel);
  panel.appendChild(optRow);

  // Buttons
  const btnRow = el("div", "flex gap-2");
  const genBtn = el("button", "btn btn-green", "Generate");
  genBtn.onclick = () => { generateSchedules(); if (state.generated.length > 0) { state.page = 'results'; } render(); };
  const clearBtn = el("button", "btn btn-white", "Clear results");
  clearBtn.onclick = () => { state.generated = []; state.ranOnce = false; render(); };
  btnRow.appendChild(genBtn); btnRow.appendChild(clearBtn);
  panel.appendChild(btnRow);

  // Status message only — full results shown on the results page
  if (state.ranOnce && state.generated.length === 0) {
    panel.appendChild(el("div", "warn-box", "No valid schedules found. Try widening time windows, lowering min credits, or unchecking 'No Friday classes.'"));
  } else if (state.generated.length > 0) {
    const hint = el("div", "no-results-box", "✓ " + state.generated.length + " schedule" + (state.generated.length !== 1 ? "s" : "") + " generated. Click Generate to view them.");
    hint.style.color = "#065f46";
    hint.style.background = "#ecfdf5";
    hint.style.borderColor = "#6ee7b7";
    panel.appendChild(hint);
  } else {
    panel.appendChild(el("div", "no-results-box", "No results yet. Click Generate."));
  }

  container.appendChild(panel);
}

// ─── Results page ────────────────────────────────────────────
function renderResultsPage() {
  const root = document.getElementById("root");
  root.innerHTML = "";

  const header = el("header", "app-header results-header");
  const backBtn = el("button", "btn btn-white", "← Edit Courses");
  backBtn.onclick = () => { state.page = "builder"; render(); };
  const title = el("h1", "", "Generated Schedules");
  const count = el("span", "results-count", state.generated.length + " option" + (state.generated.length !== 1 ? "s" : ""));
  header.appendChild(backBtn);
  header.appendChild(title);
  header.appendChild(count);
  root.appendChild(header);

  const main = el("main", "results-main");

  if (state.generated.length === 0) {
    main.appendChild(el("div", "warn-box", "No valid schedules found. Go back and adjust your filters."));
  } else {
    state.generated.forEach((r, idx) => main.appendChild(renderResultCard(r, idx)));
  }

  root.appendChild(main);
}

// ─── Full render ─────────────────────────────────────────────
function render() {
  if (state.page === "results") { renderResultsPage(); return; }

  const root = document.getElementById("root");
  root.innerHTML = "";

  // Header
  const header = el("header", "app-header");
  header.appendChild(el("h1", "", "Class Schedule Builder"));
  header.appendChild(el("p", "", "Optional courses are added only as needed. Uncheck 'Include optional courses' to see required-only schedules."));
  root.appendChild(header);

  // Main grid
  const main = el("main", "app-main");

  // Left: courses
  const left = el("section");
  const toolbar = el("div", "toolbar");
  const addBtn = el("button", "btn btn-dark", "Add course");
  addBtn.onclick = () => { state.courses.push(makeCourse({})); saveState(); render(); };
  const clearBtn = el("button", "btn btn-white", "Clear all");
  clearBtn.onclick = () => {
    if (confirm("Clear all courses?")) { state.courses = []; state.generated = []; saveState(); render(); }
  };
  toolbar.appendChild(addBtn); toolbar.appendChild(clearBtn);
  left.appendChild(toolbar);

  if (state.courses.length === 0) {
    const empty = el("div", "empty-state");
    empty.appendChild(el("p", "", "No courses yet"));
    empty.appendChild(el("p", "", "Click 'Add course' to get started."));
    left.appendChild(empty);
  } else {
    state.courses.forEach(c => left.appendChild(renderCourseCard(c)));
  }
  main.appendChild(left);

  // Right: generate panel
  const right = el("section");
  renderGeneratePanel(right);
  main.appendChild(right);

  root.appendChild(main);
}

// ─── Boot ────────────────────────────────────────────────────
window.addEventListener("error", e => {
  document.getElementById("err").textContent = e.message;
});
render();