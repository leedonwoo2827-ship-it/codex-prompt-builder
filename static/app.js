"use strict";

const $ = (id) => document.getElementById(id);

// ── 공통 유틸 ──────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function fileToDataURL(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });
}
function downloadMd(text, base) {
  let name = (base || "프롬프트").trim().replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "프롬프트";
  if (!name.endsWith(".md")) name += ".md";
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
// 텍스트를 일반/코드펜스로 나눠 렌더. 코드블록엔 복사·다운로드 버튼.
function renderContent(container, text) {
  text.split(/```/).forEach((part, i) => {
    if (i % 2 === 1) {
      const body = (/^\w+\n/.test(part) ? part.replace(/^\w+\n/, "") : part).trim();
      const actions = document.createElement("div");
      actions.className = "block-actions";
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn"; copyBtn.textContent = "복사";
      copyBtn.onclick = () => navigator.clipboard.writeText(body).then(() => {
        copyBtn.textContent = "복사됨!"; setTimeout(() => (copyBtn.textContent = "복사"), 1200);
      });
      const dlBtn = document.createElement("button");
      dlBtn.className = "btn"; dlBtn.textContent = ".md 다운로드";
      dlBtn.onclick = () => downloadMd(body);
      actions.append(copyBtn, dlBtn);
      const pre = document.createElement("pre");
      pre.textContent = body;
      container.append(actions, pre);
    } else if (part.trim()) {
      const div = document.createElement("div");
      div.innerHTML = escapeHtml(part).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      container.append(div);
    }
  });
}

// ── 페이지(탭/설정) 전환 ───────────────────────────────
function showPanel(name) {
  document.querySelectorAll(".panel[data-panel]").forEach((p) =>
    p.classList.toggle("hidden", p.dataset.panel !== name));
  document.querySelectorAll(".tab[data-tab]").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === name));
  if (name === "settings") loadSettings();
  if (name === "archive") loadArchives();
}
document.querySelectorAll(".tab[data-tab]").forEach((tab) =>
  tab.addEventListener("click", () => showPanel(tab.dataset.tab)));

// ════════════════════════════════════════════════════════
// 탭 1: 자유 빌더(채팅)
// ════════════════════════════════════════════════════════
const messages = [];
let pendingImages = [];

const chatEl = $("chat"), inputEl = $("input"), composerEl = $("composer");
const fileInput = $("fileInput"), attachPreview = $("attachPreview"), sendBtn = $("sendBtn");

function addMessage(role, content, images = []) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "user" : "bot"}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  renderContent(bubble, content);
  images.forEach((src) => {
    const img = document.createElement("img");
    img.className = "thumb"; img.src = src; bubble.append(img);
  });
  wrap.append(bubble);
  chatEl.append(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

$("attachBtn").onclick = () => fileInput.click();
fileInput.onchange = async () => {
  for (const f of fileInput.files) pendingImages.push(await fileToDataURL(f));
  fileInput.value = ""; renderAttachPreview();
};
function renderAttachPreview() {
  attachPreview.innerHTML = "";
  pendingImages.forEach((src, idx) => {
    const chip = document.createElement("div"); chip.className = "chip";
    const img = document.createElement("img"); img.src = src;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.onclick = () => { pendingImages.splice(idx, 1); renderAttachPreview(); };
    chip.append(img, x); attachPreview.append(chip);
  });
}

async function callChat(extra = {}) {
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, ...extra }),
  });
  return res.json();
}

async function send(text, images) {
  messages.push({ role: "user", content: text, images });
  addMessage("user", text || "(레퍼런스 이미지 첨부)", images);
  const typing = addMessage("bot", "");
  typing.innerHTML = '<span class="typing">생각 중…</span>';
  sendBtn.disabled = true;
  try {
    const data = await callChat();
    typing.innerHTML = "";
    if (data.ok) {
      renderContent(typing, data.reply);
      messages.push({ role: "assistant", content: data.reply, images: [] });
    } else {
      typing.innerHTML = `<span class="typing">⚠ ${escapeHtml(data.error || "오류")}</span>`;
    }
  } catch (err) {
    typing.innerHTML = `<span class="typing">⚠ 서버 연결 실패: ${escapeHtml(String(err))}</span>`;
  } finally {
    sendBtn.disabled = false; chatEl.scrollTop = chatEl.scrollHeight;
  }
}

composerEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text && pendingImages.length === 0) return;
  const images = pendingImages.slice();
  inputEl.value = ""; inputEl.style.height = "auto";
  pendingImages = []; renderAttachPreview();
  send(text, images);
});

$("finalizeBtn").onclick = async () => {
  if (messages.length === 0) { alert("먼저 대화로 원하는 내용을 알려주세요."); return; }
  const typing = addMessage("bot", "");
  typing.innerHTML = '<span class="typing">최종 프롬프트 확정 중…</span>';
  try {
    const data = await callChat({ finalize: true });
    typing.innerHTML = "";
    if (data.ok) {
      renderContent(typing, data.reply);
      messages.push({ role: "assistant", content: data.reply, images: [] });
    } else {
      typing.innerHTML = `<span class="typing">⚠ ${escapeHtml(data.error || "오류")}</span>`;
    }
  } catch (err) {
    typing.innerHTML = `<span class="typing">⚠ ${escapeHtml(String(err))}</span>`;
  }
};

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); composerEl.requestSubmit(); }
});
$("newChatBtn").onclick = () => {
  if (!confirm("현재 대화를 비우고 새로 시작할까요?")) return;
  messages.length = 0;
  document.querySelectorAll(".preset-side-item.selected").forEach((n) => n.classList.remove("selected"));
  chatEl.querySelectorAll(".msg:not(:first-child)").forEach((n) => n.remove());
};

// ── 프리셋(1번 탭 사이드) / 스타일(2번 탭 옵션) ─────────
let bundlePresets = [];   // 폴더 프리셋(카드뉴스 묶음) — 1번 탭 사이드바
let stylePresets = [];    // 스타일 카탈로그 15종 — 2번 탭 옵션

function switchTab(name) { showPanel(name); }
function styleShort(name) {
  if (!name) return "";
  return name.length > 4 ? name.slice(0, 4) + "…" : name;
}

async function loadPresets() {
  let all = [];
  try { all = (await (await fetch("/api/presets")).json()).presets || []; } catch { all = []; }
  bundlePresets = all.filter((p) => p.kind !== "style");
  stylePresets = all.filter((p) => p.kind === "style");
  renderPresetSidebar();
  renderStyleOptions();
}

function renderPresetSidebar() {
  // 두 탭의 사이드바(.preset-side-list 모두)를 동일하게 채운다.
  document.querySelectorAll(".preset-side-list").forEach((list) => {
    list.innerHTML = "";
    if (bundlePresets.length === 0) {
      list.innerHTML = '<div class="hint">presets/ 폴더 또는 「프롬프트 생성기」에서 프리셋을 추가하세요.</div>';
      return;
    }
    bundlePresets.forEach((p) => {
      const label = p.style ? `${p.name}(${styleShort(p.style)})` : p.name;
      const item = document.createElement("div");
      item.className = "preset-side-item";
      item.innerHTML = `<div class="pname">${escapeHtml(label)}${p.builtin ? "" : " ✎"}</div>` +
        (p.description ? `<div class="pdesc">${escapeHtml(p.description)}</div>` : "");
      item.onclick = () => applyBundle(p, item);
      list.append(item);
    });
  });
}

// 프리셋 선택 → 2번 탭으로 이동 + 옵션 버튼 자동 선택
function applyBundle(p, itemEl) {
  document.querySelectorAll(".preset-side-item.selected").forEach((n) => n.classList.remove("selected"));
  if (itemEl) itemEl.classList.add("selected");
  switchTab("generator");
  if (p.purpose) {
    const pu = PURPOSES.find((x) => x.key === p.purpose || x.label === p.purpose);
    if (pu) clickInGroup("grpPurpose", (b) => b.textContent === pu.label);
  }
  if (p.tone) clickInGroup("grpTone", (b) => b.textContent === p.tone);
  if (p.color) {
    if (COLORS.includes(p.color)) clickInGroup("grpColor", (b) => b.textContent === p.color);
    else $("genColorCustom").value = p.color;
  }
  if (p.style) clickInGroup("grpPreset", (b) => b.textContent === p.style);
  if (p.cuts) clickInGroup("grpCuts", (b) => Number(b.dataset.cut) === Number(p.cuts));  // 용도 뒤에 적용돼 추천값을 덮어씀
}

function clickInGroup(groupId, predicate) {
  const btn = [...$(groupId).children].find(predicate);
  if (btn) btn.click();
}

// 현재 생성기 옵션을 프리셋으로 저장
$("presetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("pName").value.trim();
  if (!name) { $("presetFormMsg").textContent = "이름을 입력하세요."; return; }
  const fd = new FormData();
  fd.append("name", name);
  fd.append("description", $("pDesc").value.trim());
  if (gen.purpose) fd.append("purpose", gen.purpose.key);
  if (gen.tone) fd.append("tone", gen.tone);
  fd.append("color", [gen.color, $("genColorCustom").value.trim()].filter(Boolean).join(" / "));
  if (gen.style) { fd.append("style", gen.style.name); fd.append("keywords", (gen.style.keywords || []).join(", ")); }
  if (gen.cuts != null) fd.append("cuts", String(gen.cuts));
  if ($("pCover").files[0]) fd.append("cover", $("pCover").files[0]);
  $("presetFormMsg").textContent = "저장 중…";
  try {
    const data = await (await fetch("/api/presets", { method: "POST", body: fd })).json();
    if (data.ok) { $("presetFormMsg").textContent = "✔ 저장됨"; $("presetForm").reset(); loadPresets(); }
    else $("presetFormMsg").textContent = "⚠ " + (data.error || "실패");
  } catch (err) { $("presetFormMsg").textContent = "⚠ " + String(err); }
});
document.querySelectorAll("#reloadPresets, .reloadPresets").forEach((b) => (b.onclick = loadPresets));

// ════════════════════════════════════════════════════════
// 탭 2: 프롬프트 생성기 (구조화)
// ════════════════════════════════════════════════════════
const PURPOSES = [
  { key: "sns", label: "SNS 카드뉴스", rec: 8, allow: [4, 6, 8, 10] },
  { key: "print", label: "인쇄 포스터", rec: 1, allow: [1, 2] },
  { key: "ppt", label: "PPT", rec: 4, allow: [1, 2, 4, 6, 8] },
  { key: "banner", label: "배너·썸네일", rec: 1, allow: [1, 2, 3] },
  { key: "cover", label: "책표지", rec: 1, allow: [1, 2] },
];
const TONES = ["후킹형", "정보형", "감성형", "신뢰·전문형"];
const COLORS = ["브랜드 색 사용", "밝고 따뜻하게", "차분·뉴트럴", "고대비·강렬"];
const CUTS = [1, 2, 3, 4, 6, 8, 10, 12];

const gen = { purpose: null, tone: null, color: null, style: null, cuts: null, manuscripts: [] };

function makeOptButtons(container, items, getLabel, onPick) {
  container.innerHTML = "";
  items.forEach((it) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt"; b.textContent = getLabel(it);
    b.onclick = () => {
      [...container.children].forEach((c) => c.classList.remove("selected"));
      b.classList.add("selected");
      onPick(it, b);
    };
    container.append(b);
  });
}

function initGenerator() {
  makeOptButtons($("grpPurpose"), PURPOSES, (p) => p.label, (p) => {
    gen.purpose = p;
    $("cutRecommend").textContent = `(추천: ${p.rec}컷)`;
    // 추천 컷 자동 선택
    const recBtn = [...$("grpCuts").children].find((c) => Number(c.dataset.cut) === p.rec);
    if (recBtn) recBtn.click();
    else validateCuts();
  });
  makeOptButtons($("grpTone"), TONES, (t) => t, (t) => (gen.tone = t));
  makeOptButtons($("grpColor"), COLORS, (c) => c, (c) => (gen.color = c));
  renderCutButtons();
}

function renderCutButtons() {
  const c = $("grpCuts");
  c.innerHTML = "";
  CUTS.forEach((n) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt"; b.dataset.cut = n; b.textContent = `${n}컷`;
    b.onclick = () => {
      [...c.children].forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      gen.cuts = n; validateCuts();
    };
    c.append(b);
  });
}

function validateCuts() {
  const msg = $("cutMsg");
  if (!gen.purpose || gen.cuts == null) { msg.textContent = ""; msg.className = "cut-msg"; return; }
  if (gen.purpose.allow.includes(gen.cuts)) {
    msg.textContent = "✔ 권장 범위입니다.";
    msg.className = "cut-msg ok";
  } else {
    msg.textContent = `⚠ '${gen.purpose.label}'에는 ${gen.cuts}컷이 권장되지 않습니다. 권장: ${gen.purpose.allow.join(", ")}컷 (추천 ${gen.purpose.rec}컷)`;
    msg.className = "cut-msg warn";
  }
}

function renderStyleOptions() {
  const grp = $("grpPreset");
  const items = [{ name: "(없음)", _none: true }, ...stylePresets];
  makeOptButtons(grp, items, (p) => p.name, (p) => (gen.style = p._none ? null : p));
}

// 생성기 원고 파일 첨부 (영상공방식 드롭존) → 서버에서 텍스트 추출
const genDrop = $("genDrop"), genFileEl = $("genFile");
$("genPick").onclick = () => genFileEl.click();
genFileEl.onchange = () => handleManuscripts(genFileEl.files);
genDrop.addEventListener("dragover", (e) => { e.preventDefault(); genDrop.classList.add("drag"); });
genDrop.addEventListener("dragleave", () => genDrop.classList.remove("drag"));
genDrop.addEventListener("drop", (e) => {
  e.preventDefault(); genDrop.classList.remove("drag");
  if (e.dataTransfer.files.length) handleManuscripts(e.dataTransfer.files);
});

async function handleManuscripts(fileList) {
  for (const f of fileList) {
    const entry = { name: f.name, text: "", chars: 0, status: "추출 중…", error: "" };
    gen.manuscripts.push(entry); renderGenFiles();
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await (await fetch("/api/extract-text", { method: "POST", body: fd })).json();
      if (r.ok) {
        entry.text = r.text; entry.chars = r.chars;
        entry.status = `${r.chars.toLocaleString()}자 추출${r.truncated ? " (앞 2만자만 사용)" : ""}`;
      } else {
        entry.error = r.note || "추출 실패"; entry.status = "";
      }
    } catch (err) {
      entry.error = String(err); entry.status = "";
    }
    renderGenFiles();
  }
  genFileEl.value = "";
}

function renderGenFiles() {
  const wrap = $("genFileList"); wrap.innerHTML = "";
  gen.manuscripts.forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "file-item" + (m.error ? " err" : "");
    row.innerHTML = `<span>📄 ${escapeHtml(m.name)}</span>` +
      `<span class="fmeta">${escapeHtml(m.error || m.status)}</span>`;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.onclick = () => { gen.manuscripts.splice(idx, 1); renderGenFiles(); };
    row.append(x); wrap.append(row);
  });
}

$("genConfirm").onclick = async () => {
  const result = $("genResult");
  const fail = (m) => (result.innerHTML = `<p class="cut-msg warn">⚠ ${escapeHtml(m)}</p>`);

  const colorCustom = $("genColorCustom").value.trim();
  const lines = ["[프롬프트 생성 요청]"];
  if (gen.purpose) lines.push(`용도: ${gen.purpose.label}`);
  if (gen.tone) lines.push(`톤: ${gen.tone}`);
  if (gen.color || colorCustom) lines.push(`색/톤앤매너: ${[gen.color, colorCustom].filter(Boolean).join(" / ")}`);
  if (gen.style) lines.push(`스타일: ${gen.style.name}${(gen.style.keywords || []).length ? ` (키워드: ${gen.style.keywords.join(", ")})` : ""}`);
  lines.push(`컷 수: ${gen.cuts ?? (gen.purpose ? gen.purpose.rec : 1)}`);
  const note = $("genNote").value.trim();
  if (note) lines.push(`추가 메모: ${note}`);

  // 원고 텍스트 합치기 (성공 추출분만)
  const manuscript = gen.manuscripts.filter((m) => m.text).map((m) => `# ${m.name}\n${m.text}`).join("\n\n");
  if (manuscript) lines.push("\n[원고 — 이 내용을 컷별로 배분]\n" + manuscript);
  lines.push("\n위 조건과 원고로 이미지 스튜디오에 바로 붙일 최종 프롬프트를 만들어줘.");

  result.innerHTML = '<p class="muted">생성 중… (모델 응답을 기다리는 중)</p>';
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: lines.join("\n"), images: [] }], finalize: true }),
    });
    if (!res.ok) return fail(`서버 오류 (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.ok) return fail(data.error || "알 수 없는 오류");
    if (!data.reply || !data.reply.trim()) return fail("모델이 빈 응답을 반환했습니다. 다시 시도해 주세요.");
    renderGenResult(data.reply);
  } catch (err) {
    fail("서버 연결 실패: " + String(err));
  }
};

// 생성기 결과: 전체 복사 / 전체 .md / 📌 보관 + 컷별 블록
function genBaseName() {
  const m = gen.manuscripts.find((x) => x.text);
  if (m) return m.name.replace(/\.[^.]+$/, "");
  if (gen.style) return gen.style.name;
  return "프롬프트";
}
function toolbarBtn(label, fn) {
  const b = document.createElement("button");
  b.className = "btn"; b.textContent = label; b.onclick = fn; return b;
}
function renderGenResult(reply) {
  const result = $("genResult"); result.innerHTML = "";
  const base = genBaseName();
  const bar = document.createElement("div");
  bar.className = "block-actions result-toolbar";
  bar.append(
    toolbarBtn("전체 복사", (e) => { navigator.clipboard.writeText(reply); flash(e.target, "복사됨!"); }),
    toolbarBtn("전체 .md 다운로드", () => downloadMd(reply, base)),
    toolbarBtn("📌 보관", async (e) => {
      e.target.disabled = true;
      const r = await saveArchive(base, reply);
      flash(e.target, r ? "보관됨 ✓" : "실패");
      e.target.disabled = false;
    }),
  );
  result.append(bar);
  renderContent(result, reply);   // 컷별 블록 + 개별 복사/다운로드
}
function flash(btn, text) {
  const old = btn.textContent; btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1200);
}

// ── 보관함(게시판) ─────────────────────────────────────
async function saveArchive(title, content) {
  try {
    const r = await (await fetch("/api/archives", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    })).json();
    return r.ok;
  } catch { return false; }
}

async function loadArchives() {
  const list = $("archiveList");
  list.innerHTML = '<p class="archive-empty">불러오는 중…</p>';
  let items = [];
  try { items = (await (await fetch("/api/archives")).json()).archives || []; } catch {}
  if (items.length === 0) {
    list.innerHTML = '<p class="archive-empty">아직 보관된 프롬프트가 없습니다. 생성기에서 「📌 보관」을 눌러 추가하세요.</p>';
    return;
  }
  list.innerHTML = "";
  items.forEach((it) => list.append(renderArchiveItem(it)));
}

function renderArchiveItem(it) {
  const item = document.createElement("div");
  item.className = "archive-item";
  const row = document.createElement("div");
  row.className = "archive-row";
  row.innerHTML =
    `<span class="a-title">${escapeHtml(it.title)}</span>` +
    `<span class="a-meta">${escapeHtml(it.created)} · ${it.chars.toLocaleString()}자</span>` +
    `<span class="a-preview">${escapeHtml(it.preview)}</span>`;
  const actions = document.createElement("div");
  actions.className = "a-actions";
  const openBtn = toolbarBtn("열기", () => toggleArchive(item, it.id));
  const delBtn = toolbarBtn("삭제", async () => {
    if (!confirm(`'${it.title}' 을(를) 삭제할까요?`)) return;
    await fetch(`/api/archives/${it.id}`, { method: "DELETE" });
    loadArchives();
  });
  actions.append(openBtn, delBtn);
  row.append(actions);
  row.onclick = (e) => { if (!e.target.closest(".a-actions")) toggleArchive(item, it.id); };
  const body = document.createElement("div");
  body.className = "archive-body";
  item.append(row, body);
  return item;
}

async function toggleArchive(item, id) {
  const body = item.querySelector(".archive-body");
  if (item.classList.contains("open")) { item.classList.remove("open"); return; }
  if (!body.dataset.loaded) {
    body.innerHTML = '<p class="muted">불러오는 중…</p>';
    const r = await (await fetch(`/api/archives/${id}`)).json();
    const content = r.ok ? r.archive.content : "(불러오지 못함)";
    body.innerHTML = "";
    const bar = document.createElement("div");
    bar.className = "block-actions";
    bar.append(
      toolbarBtn("복사", (e) => { navigator.clipboard.writeText(content); flash(e.target, "복사됨!"); }),
      toolbarBtn(".md 다운로드", () => downloadMd(content, r.ok ? r.archive.title : "프롬프트")),
    );
    const pre = document.createElement("pre");
    pre.textContent = content.replace(/```[a-zA-Z]*\n?/g, "");
    body.append(bar, pre);
    body.dataset.loaded = "1";
  }
  item.classList.add("open");
}
$("reloadArchives").onclick = loadArchives;

// ════════════════════════════════════════════════════════
// 설정 패널 (+ 프로바이더)
// ════════════════════════════════════════════════════════
// 서버 응답 전에도 동작하도록 기본값 하드코딩 (서버가 주면 덮어씀)
let providerPresets = {
  litellm: { label: "회사 LiteLLM", litellm_url: "http://localhost:4000", chat_model: "deepseek-v4-flash", vision_model: "MiMo-V2.5" },
  xiaomi: { label: "샤오미 MiMo (직접)", litellm_url: "https://api.xiaomimimo.com/v1", chat_model: "mimo-v2.5", vision_model: "mimo-v2.5" },
};
let selectedProvider = "litellm";

// ⚙ 설정 = 페이지 전환. 돌아가기는 자유 빌더로.
$("settingsBtn").onclick = () => showPanel("settings");
$("closeSettings").onclick = () => showPanel("builder");
$("closeSettingsX").onclick = () => showPanel("builder");

function highlightProvider(key) {
  selectedProvider = key;
  document.querySelectorAll("#setProvider .opt").forEach((b) =>
    b.classList.toggle("selected", b.dataset.provider === key));
}

// 토글 버튼: 클릭 시 선택 표시 + URL·모델 자동 채움
document.querySelectorAll("#setProvider .opt").forEach((btn) => {
  btn.onclick = () => {
    const key = btn.dataset.provider;
    highlightProvider(key);
    const p = providerPresets[key];
    if (p) {
      $("setUrl").value = p.litellm_url || "";
      $("setChatModel").value = p.chat_model || "";
      $("setVisionModel").value = p.vision_model || "";
    }
  };
});

async function loadSettings() {
  const { settings } = await (await fetch("/api/settings")).json();
  if (settings.provider_presets) providerPresets = settings.provider_presets;
  highlightProvider(settings.provider || "litellm");
  $("setUrl").value = settings.litellm_url || "";
  $("setChatModel").value = settings.chat_model || "";
  $("setVisionModel").value = settings.vision_model || "";
  $("setKey").value = "";
  $("keyState").textContent = settings.litellm_key_set ? `현재 키: ${settings.litellm_key_masked}` : "키 미설정";
}

function settingsBody() {
  return {
    provider: selectedProvider,
    litellm_url: $("setUrl").value.trim(),
    litellm_key: $("setKey").value.trim(),
    chat_model: $("setChatModel").value.trim(),
    vision_model: $("setVisionModel").value.trim(),
  };
}

$("saveBtn").onclick = async () => {
  await fetch("/api/settings", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settingsBody()),
  });
  $("testResult").innerHTML = '<span class="ok">✔ 저장되었습니다.</span>';
  loadSettings();
};

$("testBtn").onclick = async () => {
  const out = $("testResult");
  out.textContent = "확인 중…";
  try {
    const { result } = await (await fetch("/api/test-connection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsBody()),
    })).json();
    const line = (label, r) => r.ok
      ? `<div><span class="ok">✅ ${label} (${r.model}) — ${r.ms}ms</span></div>`
      : `<div><span class="fail">❌ ${label} (${r.model}) — ${escapeHtml(r.error)}</span></div>`;
    out.innerHTML = line("텍스트", result.chat) + line("비전", result.vision);
  } catch (err) {
    out.innerHTML = `<span class="fail">❌ 요청 실패: ${escapeHtml(String(err))}</span>`;
  }
};

// ── 초기화 ─────────────────────────────────────────────
initGenerator();
loadPresets();
showPanel("settings");   // 첫 로딩 시 설정 페이지부터
