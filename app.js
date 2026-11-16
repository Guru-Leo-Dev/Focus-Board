/* FocusBoard — a Trello-style board for study & interview prep.
 * Plain HTML + CSS + JS, no dependencies.
 *
 * Storage: every change is saved instantly in this browser (localStorage) and, once you link a
 * JSON file, written to that file automatically (File System Access API — Chrome, Edge, Brave, Opera).
 * The file is also checked every few seconds, so edits made elsewhere (e.g. a synced folder) show up.
 * Browsers without that API fall back to Export / Import.
 */
(() => {
  "use strict";

  /* ═════════════ helpers ═════════════ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = () => Date.now();
  const str = (v) => (v == null ? "" : String(v));
  const pad = (n) => String(n).padStart(2, "0");

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style") el.style.cssText = v;
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(kid));
    }
    return el;
  }

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    checklist: '<path d="M4 6l2 2 3-3M4 15l2 2 3-3M13 7h7M13 16h7"/>',
    notes: '<path d="M5 6h14M5 11h14M5 16h9"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    unlink:
      '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16"/>',
    refresh:
      '<path d="M20 11a8 8 0 0 0-14.5-3M4 5v4h4M4 13a8 8 0 0 0 14.5 3M20 19v-4h-4"/>',
  };
  function icon(name, size = 18) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[name] || "";
    return s;
  }

  const esc = (s) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const linkify = (t) =>
    esc(t).replace(
      /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g,
      (u) =>
        `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`,
    );

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function daysUntil(due) {
    const [y, m, d] = due.split("-").map(Number);
    const t = new Date();
    return Math.round(
      (new Date(y, m - 1, d) -
        new Date(t.getFullYear(), t.getMonth(), t.getDate())) /
        864e5,
    );
  }
  function fmtDue(due) {
    const n = daysUntil(due);
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n === -1) return "Yesterday";
    const [y, m, d] = due.split("-").map(Number);
    const opts = { month: "short", day: "numeric" };
    if (y !== new Date().getFullYear()) opts.year = "numeric";
    return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
  }
  function dueState(card) {
    if (card.checklist.length && card.checklist.every((i) => i.done))
      return "done";
    const n = daysUntil(card.due);
    return n < 0 ? "overdue" : n <= 2 ? "soon" : "ok";
  }

  /* ═════════════ data model ═════════════ */
  const STORE_KEY = "focusboard.data.v1";
  const PREV_KEY = "focusboard.data.previous";
  const ACTIVE_KEY = "focusboard.active";
  const THEME_KEY = "focusboard.theme";
  const PALETTE = [
    "#3fa66b",
    "#d9a400",
    "#e07b2d",
    "#d9534f",
    "#8e5bd6",
    "#3b82f6",
    "#14a3a3",
    "#d6458f",
  ];

  const TEMPLATES = {
    study: {
      name: "Study plan",
      lists: ["Backlog", "This week", "Learning", "Revise", "Done"],
    },
    interview: {
      name: "Interview tracker",
      lists: [
        "Wishlist",
        "Applied",
        "Screening",
        "Technical rounds",
        "Final / HR",
        "Offer",
        "Closed",
      ],
    },
    prep: {
      name: "Question bank",
      lists: ["To learn", "Practising", "Confident"],
    },
    blank: { name: "Blank board", lists: ["To do", "Doing", "Done"] },
  };

  const makeLabels = () => [
    { id: uid(), name: "Theory", color: "#3b82f6" },
    { id: uid(), name: "Practice", color: "#3fa66b" },
    { id: uid(), name: "Revise", color: "#e07b2d" },
    { id: uid(), name: "Important", color: "#d9534f" },
    { id: uid(), name: "Interview", color: "#8e5bd6" },
    { id: uid(), name: "Resource", color: "#14a3a3" },
  ];
  const makeList = (title) => ({ id: uid(), title, cards: [] });
  const makeCard = (title) => ({
    id: uid(),
    title,
    desc: "",
    labels: [],
    due: "",
    checklist: [],
    createdAt: now(),
    updatedAt: now(),
  });
  const makeBoard = (tpl, name) => {
    const t = TEMPLATES[tpl] || TEMPLATES.blank;
    return {
      id: uid(),
      name: name || t.name,
      createdAt: now(),
      labels: makeLabels(),
      lists: t.lists.map(makeList),
    };
  };

  function seed() {
    const study = makeBoard("study", "Study Plan");
    const welcome = makeCard("👋 Welcome! Click this card");
    welcome.desc =
      "Drag cards between lists, or click a card to add notes, links, labels, a checklist and a due date.\n\n" +
      "Add many cards at once: type one topic per line (Shift+Enter for a new line), then press Enter.\n\n" +
      "Everything is saved in this browser instantly. Click the sync button (top right) to link a JSON file and it is backed up automatically.";
    welcome.labels = [study.labels[4].id];
    welcome.checklist = [
      {
        id: uid(),
        text: "Link a JSON backup file (top-right button)",
        done: false,
      },
      { id: uid(), text: "Try the dark theme", done: false },
      { id: uid(), text: "Add my first topic", done: false },
    ];
    study.lists[0].cards.push(welcome);

    const iv = makeBoard("interview", "Interview Tracker");
    const sample = makeCard("Company — Role (sample card)");
    sample.desc =
      "Job link, recruiter name, what they asked, what to improve next time…";
    sample.labels = [iv.labels[4].id];
    sample.checklist = [
      "Tailor resume",
      "Research the team",
      "Prepare questions to ask",
    ].map((text) => ({ id: uid(), text, done: false }));
    iv.lists[0].cards.push(sample);

    return { version: 1, updatedAt: 0, boards: [study, iv] }; // updatedAt 0 = untouched starter data
  }

  function isValid(d) {
    return (
      !!d &&
      typeof d === "object" &&
      Array.isArray(d.boards) &&
      d.boards.length > 0 &&
      d.boards.every((b) => b && typeof b === "object")
    );
  }
  function normalize(d) {
    const boards = d.boards.map((b) => {
      const labels = (Array.isArray(b.labels) ? b.labels : []).map((l) => ({
        id: str(l.id) || uid(),
        name: str(l.name).slice(0, 30),
        color: /^#[0-9a-f]{6}$/i.test(str(l.color)) ? l.color : PALETTE[0],
      }));
      const ids = new Set(labels.map((l) => l.id));
      const lists = (Array.isArray(b.lists) ? b.lists : []).map((l) => ({
        id: str(l.id) || uid(),
        title: str(l.title) || "Untitled",
        cards: (Array.isArray(l.cards) ? l.cards : []).map((c) => ({
          id: str(c.id) || uid(),
          title: str(c.title) || "Untitled",
          desc: str(c.desc),
          labels: (Array.isArray(c.labels) ? c.labels : []).filter((x) =>
            ids.has(x),
          ),
          due: /^\d{4}-\d{2}-\d{2}$/.test(str(c.due)) ? c.due : "",
          checklist: (Array.isArray(c.checklist) ? c.checklist : []).map(
            (i) => ({
              id: str(i.id) || uid(),
              text: str(i.text),
              done: !!i.done,
            }),
          ),
          createdAt: Number(c.createdAt) || now(),
          updatedAt: Number(c.updatedAt) || now(),
        })),
      }));
      return {
        id: str(b.id) || uid(),
        name: str(b.name) || "Untitled board",
        createdAt: Number(b.createdAt) || now(),
        labels,
        lists,
      };
    });
    return { version: 1, updatedAt: Number(d.updatedAt) || 0, boards };
  }
  function parseData(text) {
    try {
      const d = JSON.parse(text);
      return isValid(d) ? normalize(d) : null;
    } catch {
      return null;
    }
  }

  /* ═════════════ state & persistence ═════════════ */
  let state = null;
  let activeId = null;
  const board = () =>
    state.boards.find((b) => b.id === activeId) || state.boards[0];

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? parseData(raw) : null;
    } catch {
      return null;
    }
  }
  function persistLocal() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      if (!persistLocal.warned) {
        persistLocal.warned = true;
        toast(
          "This browser is blocking storage. Link a backup file or export regularly.",
          { kind: "error", timeout: 8000 },
        );
      }
    }
  }
  function commit() {
    state.updatedAt = now();
    persistLocal();
    scheduleFileWrite();
  }
  function setActive(id) {
    activeId = id;
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  /* ═════════════ file sync (File System Access API) ═════════════ */
  const FILE_TYPES = [
    {
      description: "FocusBoard backup (JSON)",
      accept: { "application/json": [".json"] },
    },
  ];
  const fs = {
    supported: "showSaveFilePicker" in window && "showOpenFilePicker" in window,
    handle: null,
    name: "",
    granted: false,
    status: "local",
    detail: "",
    lastModified: 0,
    lastSavedAt: 0,
    writing: false,
    dirty: false,
    paused: false,
    timer: null,
  };

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("focusboard", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbOp(mode, fn) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", mode);
      const req = fn(tx.objectStore("kv"));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }
  const idbGet = (k) => idbOp("readonly", (s) => s.get(k));
  const idbSet = (k, v) => idbOp("readwrite", (s) => s.put(v, k));
  const idbDel = (k) => idbOp("readwrite", (s) => s.delete(k));

  const SYNC_TEXT = {
    unsupported: "Browser only",
    local: "Link backup",
    "needs-permission": "Reconnect",
    saving: "Saving…",
    synced: "Synced",
    error: "Sync error",
    paused: "File unreadable",
  };
  function setSync(status, detail = "") {
    fs.status = status;
    fs.detail = detail;
    const b = $("#syncBtn");
    b.dataset.state = status;
    $(".sync-text", b).textContent = SYNC_TEXT[status];
    const t = fs.lastSavedAt
      ? ` · saved ${new Date(fs.lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "";
    b.title =
      status === "synced"
        ? `Auto-saving to ${fs.name}${t}`
        : status === "needs-permission"
          ? `Click to allow writing to ${fs.name} again`
          : status === "unsupported"
            ? "Auto-sync to a file needs Chrome or Edge — click for details"
            : status === "paused"
              ? `${fs.name} isn't valid board data — auto-save paused`
              : status === "error"
                ? detail || "Sync error"
                : "Backup & sync";
    if ($("#syncDialog").open) renderSyncDialog();
  }

  async function readFileData() {
    const f = await fs.handle.getFile();
    fs.lastModified = f.lastModified;
    const text = await f.text();
    if (!text.trim()) return { empty: true };
    const data = parseData(text);
    return data ? { data } : { invalid: true };
  }
  async function writeFileOnce() {
    const w = await fs.handle.createWritable();
    await w.write(JSON.stringify(state, null, 2));
    await w.close();
    const f = await fs.handle.getFile();
    fs.lastModified = f.lastModified;
    fs.lastSavedAt = now();
  }
  function scheduleFileWrite() {
    if (!fs.handle || !fs.granted || fs.paused) return;
    fs.dirty = true;
    setSync("saving");
    clearTimeout(fs.timer);
    fs.timer = setTimeout(flush, 450);
  }
  async function flush() {
    clearTimeout(fs.timer);
    if (fs.writing || !fs.handle || !fs.granted) return;
    fs.writing = true;
    try {
      while (fs.dirty) {
        fs.dirty = false;
        await writeFileOnce();
      }
      setSync("synced");
    } catch (e) {
      fs.dirty = true;
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        fs.granted = false;
        setSync("needs-permission");
      } else if (e && e.name === "NotFoundError")
        setSync(
          "error",
          "The backup file was moved or deleted. Link a file again.",
        );
      else
        setSync(
          "error",
          `Couldn't write the file (${(e && e.message) || e}). Will retry.`,
        );
    } finally {
      fs.writing = false;
    }
  }
  async function saveNow() {
    if (!fs.handle) return;
    if (!fs.granted) return reconnect();
    fs.paused = false;
    fs.dirty = true;
    await flush();
    if (fs.status === "synced") toast("Saved to " + fs.name);
  }

  function applyExternal(data) {
    try {
      localStorage.setItem(PREV_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    state = data;
    if (!state.boards.some((b) => b.id === activeId))
      setActive(state.boards[0].id);
    persistLocal();
    closeMenu();
    render();
  }

  async function reconcile() {
    try {
      setSync("saving");
      const r = await readFileData();
      if (r.invalid) {
        fs.paused = true;
        setSync("paused");
        return;
      }
      fs.paused = false;
      if (r.empty || r.data.updatedAt < state.updatedAt) {
        fs.dirty = true;
        await flush();
      } else if (r.data.updatedAt > state.updatedAt) {
        applyExternal(r.data);
        setSync("synced");
        toast("Loaded the latest data from " + fs.name);
      } else setSync("synced");
    } catch (e) {
      setSync("error", `Couldn't read the file (${(e && e.message) || e}).`);
    }
  }

  async function pollFile() {
    if (
      !fs.handle ||
      !fs.granted ||
      fs.writing ||
      fs.dirty ||
      document.hidden ||
      ds
    )
      return;
    if ($("dialog[open]")) return;
    const ae = document.activeElement;
    if (
      ae &&
      ae.matches &&
      ae.matches("input, textarea") &&
      ae.closest("#board")
    )
      return;
    try {
      const f = await fs.handle.getFile();
      if (f.lastModified === fs.lastModified) return;
      const r = await readFileData();
      if (r.invalid) {
        fs.paused = true;
        setSync("paused");
        return;
      }
      fs.paused = false;
      if (r.empty || r.data.updatedAt < state.updatedAt) {
        fs.dirty = true;
        await flush();
      } else if (r.data.updatedAt > state.updatedAt) {
        applyExternal(r.data);
        setSync("synced");
        toast("Updated from " + fs.name);
      } else if (fs.status !== "synced") setSync("synced");
    } catch (e) {
      if (e && e.name === "NotFoundError")
        setSync(
          "error",
          "The backup file was moved or deleted. Link a file again.",
        );
    }
  }

  async function adoptHandle(handle) {
    fs.handle = handle;
    fs.name = handle.name;
    fs.granted = true;
    fs.paused = false;
    try {
      await idbSet("handle", handle);
    } catch {
      /* handle just won't be remembered next visit */
    }
  }
  async function unlink() {
    try {
      await idbDel("handle");
    } catch {
      /* ignore */
    }
    fs.handle = null;
    fs.name = "";
    fs.granted = false;
    fs.paused = false;
    fs.dirty = false;
    fs.lastSavedAt = 0;
    setSync("local");
  }
  async function initFileSync() {
    if (!fs.supported) {
      setSync("unsupported");
      return;
    }
    try {
      fs.handle = await idbGet("handle");
    } catch {
      fs.handle = null;
    }
    if (!fs.handle) {
      setSync("local");
      return;
    }
    fs.name = fs.handle.name;
    try {
      const p = await fs.handle.queryPermission({ mode: "readwrite" });
      if (p === "granted") {
        fs.granted = true;
        await reconcile();
      } else {
        setSync("needs-permission");
        toast(`Auto-sync paused — reconnect to ${fs.name}`, {
          action: "Reconnect",
          onAction: reconnect,
          timeout: 9000,
        });
      }
    } catch {
      setSync("needs-permission");
    }
  }
  async function reconnect() {
    if (!fs.handle) return openSync();
    try {
      const p = await fs.handle.requestPermission({ mode: "readwrite" });
      if (p === "granted") {
        fs.granted = true;
        await reconcile();
        if (fs.status === "synced") toast("Auto-sync is back on");
      } else
        toast(
          "Permission was not granted — your data is still safe in this browser.",
          { kind: "error" },
        );
    } catch (e) {
      toast(`Couldn't reconnect (${(e && e.message) || e})`, { kind: "error" });
    }
  }

  async function linkCreate() {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "focusboard-backup.json",
        types: FILE_TYPES,
      });
      await adoptHandle(handle);
      if (!state.updatedAt) {
        state.updatedAt = now();
        persistLocal();
      }
      fs.dirty = true;
      setSync("saving");
      await flush();
      if (fs.status === "synced")
        toast(
          `Backup file linked: ${fs.name}. Every change now saves automatically.`,
        );
    } catch (e) {
      if (e && e.name !== "AbortError")
        toast(`Couldn't create the file (${e.message})`, { kind: "error" });
    }
  }
  async function linkExisting() {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: FILE_TYPES,
        multiple: false,
        mode: "readwrite",
      });
      const p = await handle.requestPermission({ mode: "readwrite" });
      if (p !== "granted") {
        toast("Write permission is needed for auto-save.", { kind: "error" });
        return;
      }
      const previous = {
        handle: fs.handle,
        name: fs.name,
        granted: fs.granted,
      };
      await adoptHandle(handle);
      const r = await readFileData();
      if (r.invalid) {
        if (previous.handle) {
          await adoptHandle(previous.handle);
        } else {
          await unlink();
        }
        toast("That file isn't valid FocusBoard data, so it wasn't linked.", {
          kind: "error",
        });
        return;
      }
      if (r.empty) {
        fs.dirty = true;
        await flush();
      } else if (!state.updatedAt) {
        applyExternal(r.data);
        setSync("synced");
      } else {
        const choice = await ask({
          title: `Use ${handle.name}?`,
          text: "This file already contains boards. Which copy should win?",
          actions: [
            { label: "Cancel", value: "cancel" },
            { label: "Keep browser data", value: "browser" },
            { label: "Load from file", value: "file", kind: "primary" },
          ],
        });
        if (choice.action === "file") {
          applyExternal(r.data);
          setSync("synced");
        } else if (choice.action === "browser") {
          state.updatedAt = now();
          persistLocal();
          fs.dirty = true;
          await flush();
        } else {
          if (previous.handle) await adoptHandle(previous.handle);
          else await unlink();
          return;
        }
      }
      if (fs.status === "synced")
        toast(`Linked to ${fs.name}. Changes save automatically.`);
    } catch (e) {
      if (e && e.name !== "AbortError")
        toast(`Couldn't open the file (${e.message})`, { kind: "error" });
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const a = h("a", {
      href: URL.createObjectURL(blob),
      download: `focusboard-backup-${todayStr()}.json`,
    });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importJson(file) {
    if (!file) return;
    const data = parseData(await file.text());
    if (!data) {
      toast("That file isn't valid FocusBoard data.", { kind: "error" });
      return;
    }
    const r = await ask({
      title: "Replace current boards?",
      text: `Import ${data.boards.length} board(s) from ${file.name}. This replaces everything in this browser (the previous copy is kept once as a safety net).`,
      actions: [
        { label: "Cancel", value: "no" },
        { label: "Import", value: "yes", kind: "primary" },
      ],
    });
    if (r.action !== "yes") return;
    try {
      localStorage.setItem(PREV_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    state = data;
    setActive(state.boards[0].id);
    commit();
    render();
    toast("Imported " + file.name);
  }

  /* ═════════════ toasts, menus, dialogs ═════════════ */
  function toast(
    msg,
    { action, onAction, kind = "info", timeout = 4500 } = {},
  ) {
    const host = $$("dialog[open]").pop() || document.body;
    let wrap = host.querySelector(":scope > .toasts");
    if (!wrap) {
      wrap = h("div", { class: "toasts", role: "status" });
      host.append(wrap);
    }
    const remove = () => t.remove();
    const t = h(
      "div",
      { class: "toast " + kind },
      h("span", {}, msg),
      action &&
        h(
          "button",
          {
            class: "toast-action",
            type: "button",
            onclick: () => {
              remove();
              if (onAction) onAction();
            },
          },
          action,
        ),
    );
    wrap.append(t);
    setTimeout(remove, timeout);
  }

  let menuState = null;
  function closeMenu() {
    if (!menuState) return;
    const m = menuState;
    menuState = null;
    m.el.remove();
    document.removeEventListener("pointerdown", m.out, true);
    document.removeEventListener("keydown", m.key, true);
    window.removeEventListener("resize", closeMenu);
    if (m.anchor && m.anchor.isConnected)
      m.anchor.focus({ preventScroll: true });
  }
  function openMenu(anchor, items) {
    if (menuState && menuState.anchor === anchor) {
      closeMenu();
      return;
    }
    closeMenu();
    const el = h(
      "div",
      { class: "menu", role: "menu" },
      items.map((it) => {
        if (it === "-") return h("hr");
        if (it.heading) return h("div", { class: "menu-h" }, it.heading);
        return h(
          "button",
          {
            class:
              "menu-item" +
              (it.danger ? " danger" : "") +
              (it.checked ? " checked" : ""),
            type: "button",
            role: "menuitem",
            disabled: it.disabled,
            onclick: () => {
              closeMenu();
              it.action();
            },
          },
          it.icon && icon(it.icon, 16),
          h("span", { class: "menu-label" }, it.label),
        );
      }),
    );
    document.body.append(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth,
      hh = el.offsetHeight;
    let top = r.bottom + 6;
    if (top + hh > innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    el.style.top = top + "px";
    const out = (e) => {
      if (!el.contains(e.target) && !anchor.contains(e.target)) closeMenu();
    };
    const key = (e) => {
      if (e.key === "Escape" || e.key === "Tab") {
        closeMenu();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const its = $$(".menu-item:not(:disabled)", el);
        const i = its.indexOf(document.activeElement);
        its[
          (i + (e.key === "ArrowDown" ? 1 : -1) + its.length) % its.length
        ].focus();
      }
    };
    document.addEventListener("pointerdown", out, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", closeMenu);
    menuState = { el, anchor, out, key };
    const first =
      $(".menu-item.checked", el) || $(".menu-item:not(:disabled)", el);
    if (first) first.focus({ preventScroll: true });
  }

  /** Confirm / prompt dialog. Resolves { action, value }; action is null when dismissed. */
  function ask({ title, text = "", input = null, actions }) {
    return new Promise((resolve) => {
      const dlg = $("#askDialog"),
        inp = $("#askInput");
      $("#askTitle").textContent = title;
      $("#askText").textContent = text;
      $("#askText").hidden = !text;
      inp.hidden = !input;
      if (input) {
        inp.value = input.value || "";
        inp.placeholder = input.placeholder || "";
      }
      let settled = false;
      const finish = (action) => {
        if (settled) return;
        settled = true;
        const value = input ? inp.value.trim() : undefined;
        dlg.close();
        resolve({ action, value });
      };
      $("#askActions").replaceChildren(
        ...actions.map((a) =>
          h(
            "button",
            {
              class: "btn " + (a.kind || ""),
              type: "button",
              onclick: () => finish(a.value),
            },
            a.label,
          ),
        ),
      );
      inp.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const p = actions.find(
            (a) => a.kind === "primary" || a.kind === "danger",
          );
          if (p) finish(p.value);
        }
      };
      dlg.addEventListener("close", () => finish(null), { once: true });
      dlg.showModal();
      if (input) {
        inp.focus();
        inp.select();
      }
    });
  }

  /* ═════════════ rendering ═════════════ */
  const boardEl = $("#board");
  const ui = {
    composer: null,
    focusComposer: false,
    addingList: false,
    focusAddList: false,
    scrollBottom: null,
    suppressClick: false,
  };
  const filter = { q: "", labels: new Set() };

  function render() {
    renderHeader();
    renderToolbar();
    renderBoard();
  }

  function renderHeader() {
    const b = board();
    $("#boardName").textContent = b.name;
    document.title = `${b.name} · FocusBoard`;
  }

  function chipEl(l, extra) {
    return h(
      "span",
      {
        class: "chip" + (l.name ? "" : " empty"),
        style: `--lc:${l.color}`,
        title: l.name,
      },
      l.name,
    );
  }

  function renderToolbar() {
    const b = board();
    let total = 0,
      overdue = 0;
    b.lists.forEach((l) =>
      l.cards.forEach((c) => {
        total++;
        if (c.due && dueState(c) === "overdue") overdue++;
      }),
    );
    const active = !!(filter.q.trim() || filter.labels.size);
    $("#toolbar").replaceChildren(
      ...[
        h("span", { class: "toolbar-label" }, "Filter"),
        h(
          "div",
          { class: "filter-chips" },
          b.labels.map((l) => {
            const on = filter.labels.has(l.id);
            return h(
              "button",
              {
                class:
                  "chip" + (on ? " active" : "") + (l.name ? "" : " empty"),
                type: "button",
                style: `--lc:${l.color}`,
                "aria-pressed": String(on),
                title: l.name || "Unnamed label",
                onclick: () => {
                  on ? filter.labels.delete(l.id) : filter.labels.add(l.id);
                  renderToolbar();
                  applyFilter();
                },
              },
              l.name,
            );
          }),
        ),
        active
          ? h(
              "button",
              { class: "btn sm", type: "button", onclick: clearFilter },
              "Clear",
            )
          : null,
        h(
          "button",
          { class: "btn sm", type: "button", onclick: openLabels },
          icon("tag", 14),
          "Labels",
        ),
        h(
          "span",
          { class: "stats" },
          h("b", {}, String(total)),
          total === 1 ? " card" : " cards",
          overdue
            ? [" · ", h("span", { class: "bad" }, `${overdue} overdue`)]
            : null,
        ),
      ].filter(Boolean),
    );
  }
  function clearFilter() {
    filter.q = "";
    filter.labels.clear();
    $("#search").value = "";
    renderToolbar();
    applyFilter();
  }

  function matches(card, b) {
    if (filter.labels.size && !card.labels.some((id) => filter.labels.has(id)))
      return false;
    const q = filter.q.trim().toLowerCase();
    if (!q) return true;
    const names = card.labels
      .map((id) => (b.labels.find((l) => l.id === id) || {}).name || "")
      .join(" ");
    return `${card.title} ${card.desc} ${names} ${card.checklist.map((i) => i.text).join(" ")}`
      .toLowerCase()
      .includes(q);
  }
  function applyFilter() {
    const b = board();
    const active = !!(filter.q.trim() || filter.labels.size);
    b.lists.forEach((l) => {
      const le = $(`.list[data-id="${l.id}"]`, boardEl);
      if (!le) return;
      let shown = 0;
      l.cards.forEach((c) => {
        const ce = $(`.card[data-id="${c.id}"]`, le);
        if (!ce) return;
        const ok = matches(c, b);
        ce.classList.toggle("is-hidden", !ok);
        if (ok) shown++;
      });
      $(".count", le).textContent = active
        ? `${shown}/${l.cards.length}`
        : String(l.cards.length);
    });
  }

  function renderBoard() {
    const b = board();
    const left = boardEl.scrollLeft;
    const scrolls = {};
    $$(".list", boardEl).forEach((l) => {
      scrolls[l.dataset.id] = $(".cards", l).scrollTop;
    });
    boardEl.replaceChildren(...b.lists.map(listEl), addListEl());
    boardEl.scrollLeft = left;
    $$(".list", boardEl).forEach((l) => {
      const c = $(".cards", l);
      if (scrolls[l.dataset.id]) c.scrollTop = scrolls[l.dataset.id];
    });
    applyFilter();
    if (ui.scrollBottom) {
      const c = $(`.list[data-id="${ui.scrollBottom}"] .cards`, boardEl);
      if (c) c.scrollTop = c.scrollHeight;
      ui.scrollBottom = null;
    }
    if (ui.focusComposer) {
      const ta = $(".composer-input", boardEl);
      if (ta) ta.focus({ preventScroll: false });
      ui.focusComposer = false;
    }
    if (ui.focusAddList) {
      const i = $(".add-list input", boardEl);
      if (i) {
        i.focus();
        boardEl.scrollLeft = boardEl.scrollWidth;
      }
      ui.focusAddList = false;
    }
  }

  function listEl(list) {
    return h(
      "section",
      { class: "list", dataset: { id: list.id }, "aria-label": list.title },
      h(
        "header",
        { class: "list-head" },
        h(
          "h3",
          {
            class: "list-title",
            title: "Double-click to rename · drag to reorder",
            ondblclick: () => renameList(list.id),
          },
          list.title,
        ),
        h("span", { class: "count" }, String(list.cards.length)),
        h(
          "button",
          {
            class: "icon-btn sm",
            type: "button",
            "aria-label": `Actions for ${list.title}`,
            "aria-haspopup": "menu",
            onclick: (e) => listMenu(e.currentTarget, list),
          },
          icon("more"),
        ),
      ),
      h("div", { class: "cards" }, list.cards.map(cardEl)),
      ui.composer === list.id ? composerEl(list) : addCardBtn(list),
    );
  }

  function addCardBtn(list) {
    return h(
      "button",
      {
        class: "add-card-btn",
        type: "button",
        onclick: () => {
          ui.composer = list.id;
          ui.focusComposer = true;
          renderBoard();
        },
      },
      icon("plus", 16),
      "Add a card",
    );
  }
  function composerEl(list) {
    const ta = h("textarea", {
      class: "composer-input",
      rows: 2,
      maxlength: 2000,
      "aria-label": "Card title",
      placeholder: "Card title… (Shift+Enter = one card per line)",
    });
    const root = h("div", { class: "composer" });
    const close = () => {
      ui.composer = null;
      root.replaceWith(addCardBtn(list));
    };
    const submit = () => {
      const lines = ta.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!lines.length) return;
      lines.forEach((t) => list.cards.push(makeCard(t.slice(0, 200))));
      ui.focusComposer = true;
      ui.scrollBottom = list.id;
      commit();
      renderBoard();
    };
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    });
    root.append(
      ta,
      h(
        "div",
        { class: "composer-actions" },
        h(
          "button",
          { class: "btn primary sm", type: "button", onclick: submit },
          "Add card",
        ),
        h(
          "button",
          {
            class: "icon-btn sm",
            type: "button",
            "aria-label": "Cancel",
            onclick: close,
          },
          icon("x", 16),
        ),
      ),
    );
    root.addEventListener("focusout", () =>
      setTimeout(() => {
        if (
          root.isConnected &&
          !root.contains(document.activeElement) &&
          !ta.value.trim()
        )
          close();
      }, 0),
    );
    return root;
  }

  function addListEl() {
    if (ui.addingList) {
      const input = h("input", {
        class: "input",
        maxlength: 80,
        placeholder: "List title…",
        "aria-label": "New list title",
      });
      const close = () => {
        ui.addingList = false;
        renderBoard();
      };
      const submit = () => {
        const v = input.value.trim();
        if (!v) return;
        board().lists.push(makeList(v));
        ui.focusAddList = true;
        commit();
        renderBoard();
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      });
      return h(
        "div",
        { class: "add-list" },
        input,
        h(
          "div",
          { class: "composer-actions" },
          h(
            "button",
            { class: "btn primary sm", type: "button", onclick: submit },
            "Add list",
          ),
          h(
            "button",
            {
              class: "icon-btn sm",
              type: "button",
              "aria-label": "Cancel",
              onclick: close,
            },
            icon("x", 16),
          ),
        ),
      );
    }
    return h(
      "button",
      {
        class: "add-list add-list-btn",
        type: "button",
        onclick: () => {
          ui.addingList = true;
          ui.focusAddList = true;
          renderBoard();
        },
      },
      icon("plus"),
      "Add another list",
    );
  }

  function cardEl(card) {
    const b = board();
    const chips = card.labels
      .map((id) => b.labels.find((l) => l.id === id))
      .filter(Boolean);
    const total = card.checklist.length,
      done = card.checklist.filter((i) => i.done).length;
    const badges = [];
    if (card.due)
      badges.push(
        h(
          "span",
          { class: "badge due " + dueState(card), title: "Due " + card.due },
          icon("clock", 13),
          fmtDue(card.due),
        ),
      );
    if (card.desc.trim())
      badges.push(
        h("span", { class: "badge", title: "Has notes" }, icon("notes", 13)),
      );
    if (total)
      badges.push(
        h(
          "span",
          {
            class: "badge" + (done === total ? " complete" : ""),
            title: "Checklist",
          },
          icon("checklist", 13),
          `${done}/${total}`,
        ),
      );
    return h(
      "article",
      {
        class: "card",
        dataset: { id: card.id },
        tabindex: 0,
        role: "button",
        "aria-label": "Card: " + card.title,
        onclick: () => {
          if (!ui.suppressClick) openCard(card.id);
        },
        onkeydown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openCard(card.id);
          } else if (e.altKey && e.key.startsWith("Arrow")) {
            e.preventDefault();
            keyboardMove(card.id, e.key);
          }
        },
      },
      chips.length ? h("div", { class: "chips" }, chips.map(chipEl)) : null,
      h("div", { class: "card-title" }, card.title),
      badges.length ? h("div", { class: "badges" }, badges) : null,
    );
  }

  /* ═════════════ lookups & list/card operations ═════════════ */
  function findList(id) {
    const i = board().lists.findIndex((l) => l.id === id);
    return i < 0 ? null : { list: board().lists[i], index: i };
  }
  function findCard(id) {
    for (const list of board().lists) {
      const index = list.cards.findIndex((c) => c.id === id);
      if (index >= 0) return { card: list.cards[index], list, index };
    }
    return null;
  }

  function moveCardTo(id, toListId, idx = Infinity) {
    const f = findCard(id),
      to = findList(toListId);
    if (!f || !to) return;
    f.list.cards.splice(f.index, 1);
    to.list.cards.splice(Math.min(idx, to.list.cards.length), 0, f.card);
    f.card.updatedAt = now();
    commit();
    renderBoard();
  }
  function keyboardMove(id, key) {
    const b = board(),
      f = findCard(id);
    if (!f) return;
    const li = b.lists.indexOf(f.list);
    if (key === "ArrowUp" || key === "ArrowDown") {
      const j = f.index + (key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= f.list.cards.length) return;
      f.list.cards.splice(f.index, 1);
      f.list.cards.splice(j, 0, f.card);
    } else if (key === "ArrowLeft" || key === "ArrowRight") {
      const t = b.lists[li + (key === "ArrowLeft" ? -1 : 1)];
      if (!t) return;
      f.list.cards.splice(f.index, 1);
      t.cards.splice(Math.min(f.index, t.cards.length), 0, f.card);
    } else return;
    commit();
    renderBoard();
    const el = $(`.card[data-id="${id}"]`, boardEl);
    if (el) el.focus();
  }

  function deleteCard(id) {
    const f = findCard(id);
    if (!f) return;
    f.list.cards.splice(f.index, 1);
    commit();
    renderBoard();
    toast("Card deleted", {
      action: "Undo",
      timeout: 7000,
      onAction: () => {
        const l = findList(f.list.id);
        if (!l) return;
        l.list.cards.splice(Math.min(f.index, l.list.cards.length), 0, f.card);
        commit();
        renderBoard();
      },
    });
  }

  function renameList(id) {
    const f = findList(id);
    const titleEl = $(`.list[data-id="${id}"] .list-title`, boardEl);
    if (!f || !titleEl) return;
    const input = h("input", {
      class: "list-title-input",
      value: f.list.title,
      maxlength: 80,
      "aria-label": "List title",
    });
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (save && v && v !== f.list.title) {
        f.list.title = v;
        commit();
      }
      renderBoard();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }
  function sortList(list, by) {
    if (by === "title")
      list.cards.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      );
    else
      list.cards.sort((a, b) =>
        (a.due || "9999") < (b.due || "9999")
          ? -1
          : (a.due || "9999") > (b.due || "9999")
            ? 1
            : 0,
      );
    commit();
    renderBoard();
  }
  function moveList(id, dir) {
    const lists = board().lists,
      i = lists.findIndex((l) => l.id === id),
      j = i + dir;
    if (i < 0 || j < 0 || j >= lists.length) return;
    [lists[i], lists[j]] = [lists[j], lists[i]];
    commit();
    renderBoard();
  }
  async function deleteList(id) {
    let f = findList(id);
    if (!f) return;
    if (f.list.cards.length) {
      const n = f.list.cards.length;
      const r = await ask({
        title: `Delete “${f.list.title}”?`,
        text: `This also removes its ${n} card${n === 1 ? "" : "s"}. You can undo right after.`,
        actions: [
          { label: "Cancel", value: "no" },
          { label: "Delete list", value: "yes", kind: "danger" },
        ],
      });
      if (r.action !== "yes") return;
      f = findList(id);
      if (!f) return;
    }
    const removed = f.list,
      at = f.index;
    board().lists.splice(at, 1);
    commit();
    renderBoard();
    toast(`List “${removed.title}” deleted`, {
      action: "Undo",
      timeout: 7000,
      onAction: () => {
        board().lists.splice(Math.min(at, board().lists.length), 0, removed);
        commit();
        renderBoard();
      },
    });
  }
  function listMenu(anchor, list) {
    const n = board().lists.length,
      i = board().lists.indexOf(list);
    openMenu(anchor, [
      {
        label: "Add card",
        icon: "plus",
        action: () => {
          ui.composer = list.id;
          ui.focusComposer = true;
          renderBoard();
        },
      },
      { label: "Rename list", icon: "edit", action: () => renameList(list.id) },
      "-",
      {
        label: "Sort by due date",
        icon: "clock",
        action: () => sortList(list, "due"),
      },
      {
        label: "Sort A → Z",
        icon: "notes",
        action: () => sortList(list, "title"),
      },
      "-",
      {
        label: "Move left",
        icon: "left",
        disabled: i === 0,
        action: () => moveList(list.id, -1),
      },
      {
        label: "Move right",
        icon: "right",
        disabled: i === n - 1,
        action: () => moveList(list.id, 1),
      },
      "-",
      {
        label: "Delete list…",
        icon: "trash",
        danger: true,
        action: () => deleteList(list.id),
      },
    ]);
  }

  /* ═════════════ boards ═════════════ */
  function switchBoard(id) {
    setActive(id);
    filter.labels.clear();
    ui.composer = null;
    ui.addingList = false;
    render();
  }
  function openBoardMenu(anchor) {
    openMenu(anchor, [
      { heading: "Your boards" },
      ...state.boards.map((b) => ({
        label: b.name,
        checked: b.id === board().id,
        action: () => switchBoard(b.id),
      })),
      "-",
      { label: "New board…", icon: "plus", action: openNewBoard },
      { label: "Rename board…", icon: "edit", action: renameBoard },
      {
        label: "Delete board…",
        icon: "trash",
        danger: true,
        action: deleteBoard,
      },
    ]);
  }
  async function renameBoard() {
    const r = await ask({
      title: "Rename board",
      input: { value: board().name },
      actions: [
        { label: "Cancel", value: "no" },
        { label: "Save", value: "ok", kind: "primary" },
      ],
    });
    if (r.action === "ok" && r.value) {
      board().name = r.value;
      commit();
      render();
    }
  }
  async function deleteBoard() {
    const b = board();
    const n = b.lists.reduce((s, l) => s + l.cards.length, 0);
    const r = await ask({
      title: `Delete “${b.name}”?`,
      text: `${b.lists.length} list(s) and ${n} card(s) will be removed. You can undo right after.`,
      actions: [
        { label: "Cancel", value: "no" },
        { label: "Delete board", value: "yes", kind: "danger" },
      ],
    });
    if (r.action !== "yes") return;
    const at = state.boards.indexOf(b);
    state.boards.splice(at, 1);
    let replacement = null;
    if (!state.boards.length) {
      replacement = makeBoard("blank", "My board");
      state.boards.push(replacement);
    }
    switchBoard(state.boards[Math.min(at, state.boards.length - 1)].id);
    commit();
    toast(`Board “${b.name}” deleted`, {
      action: "Undo",
      timeout: 8000,
      onAction: () => {
        if (
          replacement &&
          state.boards.length === 1 &&
          state.boards[0] === replacement
        )
          state.boards.pop();
        state.boards.splice(Math.min(at, state.boards.length), 0, b);
        commit();
        switchBoard(b.id);
      },
    });
  }
  function openNewBoard() {
    $("#nbName").value = "";
    $("#tplList").replaceChildren(
      ...Object.entries(TEMPLATES).map(([k, t], i) =>
        h(
          "label",
          { class: "tpl" },
          h("input", {
            type: "radio",
            name: "tpl",
            value: k,
            checked: i === 0,
          }),
          h(
            "span",
            {},
            h("strong", {}, t.name),
            h("small", {}, t.lists.join(" · ")),
          ),
        ),
      ),
    );
    $("#newBoardDialog").showModal();
    $("#nbName").focus();
  }

  /* ═════════════ labels dialog ═════════════ */
  function openLabels() {
    renderLabelsEditor();
    $("#labelsDialog").showModal();
  }
  function renderLabelsEditor() {
    const b = board();
    $("#labelsList").replaceChildren(
      ...b.labels.map((l) =>
        h(
          "div",
          { class: "label-row" },
          h("input", {
            type: "color",
            value: l.color,
            "aria-label": "Label colour",
            oninput: (e) => {
              l.color = e.target.value;
              commit();
            },
          }),
          h("input", {
            type: "text",
            class: "input",
            value: l.name,
            maxlength: 30,
            placeholder: "Label name",
            "aria-label": "Label name",
            oninput: (e) => {
              l.name = e.target.value;
              commit();
            },
          }),
          h(
            "button",
            {
              class: "icon-btn sm",
              type: "button",
              "aria-label": "Delete label",
              onclick: () => {
                b.lists.forEach((li) =>
                  li.cards.forEach((c) => {
                    c.labels = c.labels.filter((x) => x !== l.id);
                  }),
                );
                filter.labels.delete(l.id);
                b.labels = b.labels.filter((x) => x.id !== l.id);
                commit();
                renderLabelsEditor();
              },
            },
            icon("trash", 16),
          ),
        ),
      ),
    );
  }

  /* ═════════════ card dialog ═════════════ */
  const cardDlg = $("#cardDialog");
  let cdId = null;
  const curCard = () => (cdId ? findCard(cdId) : null);

  function openCard(id) {
    if (!findCard(id)) return;
    cdId = id;
    fillCard();
    cardDlg.showModal();
    $("#cdTitle").blur();
  }
  function fillCard() {
    const f = curCard();
    if (!f) return;
    const b = board();
    $("#cdTitle").value = f.card.title;
    const sel = $("#cdList");
    sel.replaceChildren(
      ...b.lists.map((l) => h("option", { value: l.id }, l.title)),
    );
    sel.value = f.list.id;
    $("#cdDue").value = f.card.due;
    $("#cdDesc").hidden = true;
    $("#cdDescView").hidden = false;
    renderCdLabels();
    renderDesc();
    renderChecklist();
    renderMeta();
  }
  function touchCard(card) {
    card.updatedAt = now();
    renderMeta();
  }
  function renderMeta() {
    const f = curCard();
    if (!f) return;
    const fmt = (t) =>
      new Date(t).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
    $("#cdMeta").textContent =
      `Created ${fmt(f.card.createdAt)} · Updated ${fmt(f.card.updatedAt)}`;
  }
  function renderCdLabels() {
    const f = curCard();
    if (!f) return;
    $("#cdLabels").replaceChildren(
      ...board().labels.map((l) => {
        const on = f.card.labels.includes(l.id);
        return h(
          "button",
          {
            class: "chip" + (on ? " active" : "") + (l.name ? "" : " empty"),
            type: "button",
            style: `--lc:${l.color}`,
            "aria-pressed": String(on),
            onclick: () => {
              const c = curCard().card;
              c.labels = on
                ? c.labels.filter((x) => x !== l.id)
                : [...c.labels, l.id];
              touchCard(c);
              commit();
              renderCdLabels();
            },
          },
          l.name,
        );
      }),
      h(
        "button",
        { class: "chip add", type: "button", onclick: openLabels },
        icon("plus", 12),
        "Edit labels",
      ),
    );
  }
  function renderDesc() {
    const f = curCard();
    if (!f) return;
    const t = f.card.desc;
    $("#cdDescView").innerHTML = t.trim()
      ? linkify(t)
      : '<span class="placeholder">Add notes, links, resources, answers…</span>';
  }
  function editDesc() {
    const f = curCard();
    if (!f) return;
    const ta = $("#cdDesc");
    ta.value = f.card.desc;
    $("#cdDescView").hidden = true;
    ta.hidden = false;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  function renderChecklist() {
    const f = curCard();
    if (!f) return;
    const card = f.card,
      items = card.checklist;
    $("#cdChecklist").replaceChildren(
      ...items.map((it) =>
        h(
          "li",
          { class: "ck-item" + (it.done ? " done" : "") },
          h("input", {
            type: "checkbox",
            checked: it.done,
            "aria-label": "Done",
            onchange: (e) => {
              it.done = e.target.checked;
              touchCard(card);
              commit();
              renderChecklist();
            },
          }),
          h("input", {
            class: "ck-text",
            value: it.text,
            maxlength: 300,
            "aria-label": "Checklist item",
            oninput: (e) => {
              it.text = e.target.value;
              commit();
            },
            onkeydown: (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                $("#cdNewItem").focus();
              }
            },
          }),
          h(
            "button",
            {
              class: "icon-btn sm",
              type: "button",
              "aria-label": "Remove item",
              onclick: () => {
                card.checklist = card.checklist.filter((x) => x !== it);
                touchCard(card);
                commit();
                renderChecklist();
              },
            },
            icon("x", 14),
          ),
        ),
      ),
    );
    const done = items.filter((i) => i.done).length;
    $("#cdProg").textContent = items.length ? `${done}/${items.length}` : "";
    $("#cdBar").style.width =
      (items.length ? Math.round((done / items.length) * 100) : 0) + "%";
    $("#cdProgress").hidden = !items.length;
    $("#cdClearDone").hidden = !done;
  }

  function wireCardDialog() {
    $("#cdTitle").addEventListener("input", (e) => {
      const f = curCard(),
        v = e.target.value.trim();
      if (f && v) {
        f.card.title = v;
        touchCard(f.card);
        commit();
      }
    });
    $("#cdTitle").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.target.blur();
      }
    });
    $("#cdTitle").addEventListener("blur", () => {
      const f = curCard();
      if (f) $("#cdTitle").value = f.card.title;
    });
    $("#cdList").addEventListener("change", (e) =>
      moveCardTo(cdId, e.target.value),
    );
    $("#cdDue").addEventListener("change", (e) => {
      const f = curCard();
      if (f) {
        f.card.due = e.target.value;
        touchCard(f.card);
        commit();
      }
    });
    $("#cdDueClear").addEventListener("click", () => {
      const f = curCard();
      if (f) {
        f.card.due = "";
        $("#cdDue").value = "";
        touchCard(f.card);
        commit();
      }
    });

    const view = $("#cdDescView"),
      ta = $("#cdDesc");
    view.addEventListener("click", (e) => {
      if (!e.target.closest("a")) editDesc();
    });
    view.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        editDesc();
      }
    });
    ta.addEventListener("input", () => {
      const f = curCard();
      if (f) {
        f.card.desc = ta.value;
        touchCard(f.card);
        commit();
      }
    });
    ta.addEventListener("blur", () => {
      ta.hidden = true;
      view.hidden = false;
      renderDesc();
    });

    $("#cdAddItem").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = curCard(),
        input = $("#cdNewItem"),
        v = input.value.trim();
      if (!f || !v) return;
      f.card.checklist.push({ id: uid(), text: v, done: false });
      input.value = "";
      touchCard(f.card);
      commit();
      renderChecklist();
      input.focus();
    });
    $("#cdClearDone").addEventListener("click", () => {
      const f = curCard();
      if (!f) return;
      f.card.checklist = f.card.checklist.filter((i) => !i.done);
      touchCard(f.card);
      commit();
      renderChecklist();
    });
    $("#cdDuplicate").addEventListener("click", () => {
      const f = curCard();
      if (!f) return;
      const copy = JSON.parse(JSON.stringify(f.card));
      copy.id = uid();
      copy.title = f.card.title + " (copy)";
      copy.createdAt = copy.updatedAt = now();
      copy.checklist.forEach((i) => {
        i.id = uid();
      });
      f.list.cards.splice(f.index + 1, 0, copy);
      commit();
      renderBoard();
      toast("Card duplicated");
    });
    $("#cdDelete").addEventListener("click", () => {
      const id = cdId;
      cardDlg.close();
      deleteCard(id);
    });
    cardDlg.addEventListener("close", () => {
      cdId = null;
      renderBoard();
      renderToolbar();
    });
    $("#labelsDialog").addEventListener("close", () => {
      renderToolbar();
      if (cdId) renderCdLabels();
      renderBoard();
    });
    $("#addLabelBtn").addEventListener("click", () => {
      const b = board();
      b.labels.push({
        id: uid(),
        name: "",
        color: PALETTE[b.labels.length % PALETTE.length],
      });
      commit();
      renderLabelsEditor();
      const rows = $$('.label-row input[type="text"]', $("#labelsList"));
      if (rows.length) rows[rows.length - 1].focus();
    });
  }

  /* ═════════════ sync dialog ═════════════ */
  function openSync() {
    renderSyncDialog();
    $("#syncDialog").showModal();
  }
  function renderSyncDialog() {
    const t = fs.lastSavedAt
      ? ` Last saved ${new Date(fs.lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
      : "";
    const MSG = {
      unsupported: [
        "Browser storage only",
        "This browser can't write to a file automatically. Your data is saved inside the browser; use Export now and then. For automatic file backup open FocusBoard in Chrome, Edge, Brave or Opera (over file:// or http://localhost).",
      ],
      local: [
        "Not linked to a file yet",
        "Your data is saved in this browser. Link a JSON file to also back it up automatically.",
      ],
      "needs-permission": [
        `Linked to ${fs.name}`,
        "The browser asks permission again after it restarts. Click Reconnect to resume auto-save.",
      ],
      saving: [`Saving to ${fs.name || "file"}…`, ""],
      synced: [
        `Auto-saving to ${fs.name}`,
        "Every change is written about half a second after you make it." + t,
      ],
      error: ["Sync problem", fs.detail],
      paused: [
        `${fs.name} can't be read`,
        "It changed outside the app and isn't valid board data, so auto-save is paused to protect it. Fix or replace the file, or overwrite it with the boards from this browser.",
      ],
    };
    const [title, text] = MSG[fs.status] || MSG.local;
    const linked = !!fs.handle;
    const btns = [];
    if (fs.supported) {
      if (linked && fs.status === "needs-permission")
        btns.push(
          h(
            "button",
            {
              class: "btn primary",
              type: "button",
              onclick: async () => {
                await reconnect();
              },
            },
            icon("refresh", 16),
            "Reconnect",
          ),
        );
      if (linked && fs.granted)
        btns.push(
          h(
            "button",
            {
              class: "btn" + (fs.status === "paused" ? " primary" : ""),
              type: "button",
              onclick: saveNow,
            },
            icon("save", 16),
            fs.status === "paused"
              ? "Overwrite file with current boards"
              : "Save now",
          ),
        );
      btns.push(
        h(
          "button",
          {
            class: "btn" + (!linked ? " primary" : ""),
            type: "button",
            onclick: linkCreate,
          },
          icon("file", 16),
          linked ? "Save to a new file…" : "Create backup file…",
        ),
      );
      btns.push(
        h(
          "button",
          { class: "btn", type: "button", onclick: linkExisting },
          icon("upload", 16),
          linked ? "Switch to another existing file…" : "Use an existing file…",
        ),
      );
      if (linked)
        btns.push(
          h(
            "button",
            {
              class: "btn subtle-danger",
              type: "button",
              onclick: async () => {
                await unlink();
                toast("Unlinked. Your file was left untouched.");
              },
            },
            icon("unlink", 16),
            "Stop syncing",
          ),
        );
    }
    $("#syncBody").replaceChildren(
      h(
        "div",
        { class: "sync-body" },
        h(
          "div",
          { class: "sync-status", dataset: { state: fs.status } },
          h("span", { class: "dot" }),
          h(
            "div",
            {},
            h("strong", {}, title),
            text && h("span", { class: "muted small" }, text),
          ),
        ),
        btns.length ? h("div", { class: "btn-col" }, btns) : null,
        fs.supported
          ? h(
              "p",
              { class: "muted small" },
              "Tip: keep the file inside a OneDrive / Google Drive / Dropbox folder to get a cloud copy too. The file is re-checked every few seconds, so changes made on another computer appear here by themselves (the newest save wins).",
            )
          : null,
        h("hr", { class: "rule" }),
        h("h4", { class: "sec-title" }, "Manual backup"),
        h(
          "div",
          { class: "btn-col" },
          h(
            "button",
            { class: "btn", type: "button", onclick: exportJson },
            icon("download", 16),
            "Export JSON",
          ),
          h(
            "button",
            {
              class: "btn",
              type: "button",
              onclick: () => $("#importInput").click(),
            },
            icon("upload", 16),
            "Import JSON…",
          ),
        ),
      ),
    );
  }

  /* ═════════════ drag & drop (pointer based: mouse, pen and touch) ═════════════ */
  let ds = null; // current drag session

  boardEl.addEventListener("pointerdown", (e) => {
    if (ds || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (
      e.target.closest("button, input, textarea, select, .composer, .add-list")
    )
      return;
    const card = e.target.closest(".card"),
      head = e.target.closest(".list-head");
    const el = card || (head && head.closest(".list"));
    if (!el) return;
    ds = {
      kind: card ? "card" : "list",
      el,
      pid: e.pointerId,
      touch: e.pointerType === "touch",
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      timer: null,
      raf: 0,
    };
    if (ds.touch)
      ds.timer = setTimeout(() => {
        if (ds && !ds.active) beginDrag();
      }, 280); // long-press to pick up
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
  });
  document.addEventListener(
    "touchmove",
    (e) => {
      if (ds && ds.active) e.preventDefault();
    },
    { passive: false },
  );
  boardEl.addEventListener("contextmenu", (e) => {
    if (ds && ds.touch) e.preventDefault();
  });
  document.addEventListener(
    "click",
    (e) => {
      if (ui.suppressClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );

  function dragCleanup() {
    if (!ds) return;
    clearTimeout(ds.timer);
    cancelAnimationFrame(ds.raf);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    ds = null;
  }
  function onMove(e) {
    if (!ds || e.pointerId !== ds.pid) return;
    ds.x = e.clientX;
    ds.y = e.clientY;
    if (!ds.active) {
      const dist = Math.hypot(ds.x - ds.sx, ds.y - ds.sy);
      if (ds.touch) {
        if (dist > 10) dragCleanup();
        return;
      } // finger moved first → it's a scroll
      if (dist < 6) return;
      beginDrag();
    }
    e.preventDefault();
    updateDrag();
  }
  function onUp(e) {
    if (!ds || e.pointerId !== ds.pid) return;
    if (ds.active) finishDrag(true);
    else dragCleanup();
  }
  function onCancel(e) {
    if (!ds || e.pointerId !== ds.pid) return;
    if (ds.active) finishDrag(false);
    else dragCleanup();
  }
  function beginDrag() {
    clearTimeout(ds.timer);
    closeMenu();
    ds.active = true;
    const r = ds.el.getBoundingClientRect();
    ds.offX = ds.x - r.left;
    ds.offY = ds.y - r.top;
    const g = ds.el.cloneNode(true);
    g.classList.add("drag-ghost");
    g.setAttribute("aria-hidden", "true");
    g.removeAttribute("tabindex");
    g.style.width = r.width + "px";
    g.style.height = Math.min(r.height, innerHeight * 0.7) + "px";
    document.body.append(g);
    ds.ghost = g;
    ds.el.classList.add("drag-placeholder");
    document.body.classList.add("is-dragging");
    if (ds.touch && navigator.vibrate) navigator.vibrate(10);
    ds.raf = requestAnimationFrame(autoScroll);
    updateDrag();
  }
  function updateDrag() {
    ds.ghost.style.transform = `translate(${ds.x - ds.offX}px, ${ds.y - ds.offY}px) rotate(2deg)`;
    if (ds.kind === "card") placeCard();
    else placeList();
  }
  function placeCard() {
    const under = document.elementFromPoint(ds.x, ds.y);
    const le = under && under.closest(".list");
    if (!le || !boardEl.contains(le)) return;
    const cardsEl = $(".cards", le);
    const sibs = Array.from(cardsEl.children).filter(
      (c) => c !== ds.el && !c.classList.contains("is-hidden"),
    );
    let before = null;
    for (const c of sibs) {
      const r = c.getBoundingClientRect();
      if (ds.y < r.top + r.height / 2) {
        before = c;
        break;
      }
    }
    if (before) {
      if (ds.el.parentNode !== cardsEl || ds.el.nextElementSibling !== before)
        cardsEl.insertBefore(ds.el, before);
    } else if (
      ds.el.parentNode !== cardsEl ||
      cardsEl.lastElementChild !== ds.el
    )
      cardsEl.append(ds.el);
  }
  function placeList() {
    const sibs = $$(".list", boardEl).filter((l) => l !== ds.el);
    let before = null;
    for (const l of sibs) {
      const r = l.getBoundingClientRect();
      if (ds.x < r.left + r.width / 2) {
        before = l;
        break;
      }
    }
    const anchor = before || $(".add-list", boardEl);
    if (ds.el.nextElementSibling !== anchor)
      boardEl.insertBefore(ds.el, anchor);
  }
  function autoScroll() {
    if (!ds || !ds.active) return;
    const edge = 70,
      speed = (d) =>
        Math.ceil(Math.max(0, Math.min(1, (edge - d) / edge)) * 18);
    const br = boardEl.getBoundingClientRect();
    let moved = false;
    if (ds.x < br.left + edge) {
      boardEl.scrollLeft -= speed(ds.x - br.left);
      moved = true;
    } else if (ds.x > br.right - edge) {
      boardEl.scrollLeft += speed(br.right - ds.x);
      moved = true;
    }
    if (ds.kind === "card") {
      const under = document.elementFromPoint(ds.x, ds.y);
      const le = under && under.closest(".list");
      if (le) {
        const c = $(".cards", le),
          cr = c.getBoundingClientRect();
        if (ds.y < cr.top + 50) {
          c.scrollTop -= speed(ds.y - cr.top);
          moved = true;
        } else if (ds.y > cr.bottom - 50) {
          c.scrollTop += speed(cr.bottom - ds.y);
          moved = true;
        }
      }
    }
    if (moved) {
      if (ds.kind === "card") placeCard();
      else placeList();
    }
    ds.raf = requestAnimationFrame(autoScroll);
  }
  function finishDrag(save) {
    const kind = ds.kind;
    ds.ghost.remove();
    ds.el.classList.remove("drag-placeholder");
    document.body.classList.remove("is-dragging");
    if (save) syncFromDom(kind);
    dragCleanup();
    renderBoard();
    ui.suppressClick = true;
    setTimeout(() => {
      ui.suppressClick = false;
    }, 80);
  }
  function syncFromDom(kind) {
    const b = board();
    let changed = false;
    if (kind === "list") {
      const order = $$(".list", boardEl).map((l) => l.dataset.id);
      const next = order
        .map((id) => b.lists.find((l) => l.id === id))
        .filter(Boolean);
      if (
        next.length === b.lists.length &&
        next.some((l, i) => l !== b.lists[i])
      ) {
        b.lists = next;
        changed = true;
      }
    } else {
      const map = new Map();
      b.lists.forEach((l) => l.cards.forEach((c) => map.set(c.id, c)));
      const movedId = ds.el.dataset.id;
      $$(".list", boardEl).forEach((le) => {
        const l = b.lists.find((x) => x.id === le.dataset.id);
        if (!l) return;
        const next = $$(".card", $(".cards", le))
          .map((c) => map.get(c.dataset.id))
          .filter(Boolean);
        if (
          next.length !== l.cards.length ||
          next.some((c, i) => c !== l.cards[i])
        )
          changed = true;
        l.cards = next;
      });
      if (changed && map.get(movedId)) map.get(movedId).updatedAt = now();
    }
    if (changed) commit();
  }

  /* ═════════════ theme ═════════════ */
  function applyTheme(t, save) {
    document.documentElement.dataset.theme = t;
    if (save) {
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch {
        /* ignore */
      }
    }
    const btn = $("#themeBtn");
    btn.replaceChildren(icon(t === "dark" ? "sun" : "moon", 20));
    btn.setAttribute(
      "aria-label",
      t === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    const meta = $('meta[name="theme-color"]');
    if (meta && bg) meta.content = bg;
  }
  const toggleTheme = () =>
    applyTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      true,
    );

  /* ═════════════ wiring & boot ═════════════ */
  function wire() {
    $$("[data-icon]").forEach((el) =>
      el.prepend(icon(el.dataset.icon, Number(el.dataset.size) || 18)),
    );
    $("#boardMenuBtn").append(icon("chevron", 16));

    $$("dialog").forEach((dlg) => {
      let downOnBackdrop = false;
      dlg.addEventListener("pointerdown", (e) => {
        downOnBackdrop = e.target === dlg;
      });
      dlg.addEventListener("click", (e) => {
        if (e.target === dlg && downOnBackdrop) dlg.close();
      });
    });
    $$("[data-close]").forEach((b) =>
      b.addEventListener("click", () => b.closest("dialog").close()),
    );

    $("#themeBtn").addEventListener("click", toggleTheme);
    try {
      matchMedia("(prefers-color-scheme: dark)").addEventListener(
        "change",
        (e) => {
          if (!localStorage.getItem(THEME_KEY))
            applyTheme(e.matches ? "dark" : "light", false);
        },
      );
    } catch {
      /* ignore */
    }

    $("#boardMenuBtn").addEventListener("click", (e) =>
      openBoardMenu(e.currentTarget),
    );
    $("#syncBtn").addEventListener("click", () => {
      if (fs.status === "needs-permission") reconnect();
      else openSync();
    });
    $("#importInput").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      await importJson(f);
    });

    $("#search").addEventListener("input", (e) => {
      filter.q = e.target.value;
      renderToolbar();
      applyFilter();
    });
    $("#newBoardForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const tpl =
        ($('input[name="tpl"]:checked', e.target) || {}).value || "blank";
      const nb = makeBoard(tpl, $("#nbName").value.trim());
      state.boards.push(nb);
      $("#newBoardDialog").close();
      commit();
      switchBoard(nb.id);
    });

    wireCardDialog();

    document.addEventListener("keydown", (e) => {
      const typing =
        e.target.matches &&
        e.target.matches("input, textarea, select, [contenteditable]");
      if (e.key === "Escape" && ds && ds.active) {
        finishDrag(false);
        return;
      }
      if (e.key === "Escape" && e.target === $("#search")) {
        clearFilter();
        e.target.blur();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || $("dialog[open]"))
        return;
      if (e.key === "/") {
        e.preventDefault();
        $("#search").focus();
      } else if (e.key === "t") toggleTheme();
      else if (e.key === "n") {
        const first = board().lists[0];
        if (first) {
          e.preventDefault();
          ui.composer = first.id;
          ui.focusComposer = true;
          renderBoard();
        }
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (fs.dirty) flush();
      } else pollFile();
    });
    window.addEventListener("focus", pollFile);
    window.addEventListener("pagehide", () => {
      if (fs.dirty) flush();
    });
    setInterval(pollFile, 4000);
  }

  function init() {
    state = loadLocal();
    if (!state) {
      state = seed();
      persistLocal();
    }
    let saved = null;
    try {
      saved = localStorage.getItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    activeId = state.boards.some((b) => b.id === saved)
      ? saved
      : state.boards[0].id;
    wire();
    applyTheme(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      false,
    );
    render();
    initFileSync();
  }
  init();
})();
