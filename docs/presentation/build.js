// 싱클 발표 자료 (KCC AI Agent 미니 캡스톤) — pptxgenjs
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const QRCode = require("qrcode");
const lu = require("react-icons/lu");
const path = require("path");
const { applyTheme } = require(process.env.SKILL + "/scripts/apply_theme.js");

const OUT = path.join(__dirname, "Syncle_발표.pptx");
const SHOT = (n) => path.join(__dirname, "shots", n + ".png");
const DEMO_URL = "https://syncle-web-git-integration-b-d-unione1.vercel.app";

const THEME = {
  name: "Syncle",
  headFontFace: "Pretendard",
  bodyFontFace: "Pretendard",
  colors: {
    dk1: "1B1F2E", lt1: "FFFFFF", dk2: "12163A", lt2: "F3F5FC",
    accent1: "3346D3", accent2: "1E9E6A", accent3: "E6E9FB", accent4: "6B7280",
    accent5: "E8762C", accent6: "C3C9D8", hlink: "3346D3", folHlink: "3346D3",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "싱클 (Syncle) · AI 회의 조율 협업툴";
pres.author = "싱클 팀";
const C = pres.SchemeColor;
const INK = C.text1, NAVY = C.text2, WHITE = C.background1, TINT = C.background2;
const BLUE = C.accent1, GREEN = C.accent2, SOFT = C.accent3, MUTED = C.accent4, ORANGE = C.accent5, LINE = C.accent6;

// ── 아이콘 · 로고 · QR (PNG data) ──
async function svgPng(svg, size = 256) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function icon(name, hex) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(lu[name], { color: "#" + hex, size: 256, strokeWidth: 1.8 }));
  return svgPng(svg);
}
function logoSvg(fill, ink) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none"><path d="M28 12H68A18 18 0 0 1 86 30V52A18 18 0 0 1 68 70H44L28 84V70A18 18 0 0 1 10 52V30A18 18 0 0 1 28 12Z" fill="#${fill}"/><path d="M31 50L48 30L65 50Z" stroke="#${ink}" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="30" r="7" fill="#${ink}"/><circle cx="31" cy="50" r="7" fill="#${ink}"/><circle cx="65" cy="50" r="7" fill="#${ink}"/></svg>`;
}

// ── 레이아웃 ──
pres.defineSlideMaster({
  title: "DARK",
  background: { color: NAVY },
  objects: [],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: WHITE },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.42, w: 8.5, h: 0.32, fontSize: 13, bold: true, color: BLUE, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.78, w: 12.1, h: 0.8, fontSize: 30, bold: true, color: INK, margin: 0, valign: "top", align: "left" }, text: "" } },
  ],
  slideNumber: { x: 12.13, y: 7.02, w: 0.6, h: 0.28, fontSize: 10, color: MUTED, align: "right", margin: 0 },
});

function content(section, kicker, title) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
}
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: INK, fontSize: 14, valign: "top", ...o });
const box = (s, o) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.12, line: { type: "none" }, ...o });
function iconTile(s, img, x, y, size = 0.5, bg = SOFT) {
  box(s, { x, y, w: size, h: size, fill: { color: bg }, rectRadius: 0.1 });
  const p = size * 0.56;
  s.addImage({ data: img, x: x + (size - p) / 2, y: y + (size - p) / 2, w: p, h: p });
}
function phone(s, name, x, y, h, alt) {
  const w = h * (764 / 1672);
  s.addImage({ path: SHOT(name), x, y, w, h, altText: alt });
  return w;
}
// 위 · 왼쪽으로 가는 선은 크기를 음수로 쓰면 PowerPoint가 파일을 깨진 것으로 봐요 → 양수 크기 + 뒤집기
const arrow = (s, x, y, w, h, o = {}) => {
  const flip = {};
  if (h < 0) { y += h; h = -h; flip.flipV = true; }
  if (w < 0) { x += w; w = -w; flip.flipH = !o.flipH; }
  s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: MUTED, width: 1.25, endArrowType: "triangle" }, ...o, ...flip });
};

(async () => {
  const I = {};
  const needs = {
    chat: "LuMessagesSquare", clock: "LuClock", pin: "LuMapPin", cal: "LuCalendarCheck", spark: "LuSparkles",
    users: "LuUsers", brain: "LuBrain", db: "LuDatabase", code: "LuCode", route: "LuRoute", scale: "LuScale",
    check: "LuCircleCheck", bell: "LuBell", file: "LuFileText", repeat: "LuRepeat", mega: "LuMegaphone",
    phone: "LuSmartphone", server: "LuServer", eye: "LuEye", cap: "LuGraduationCap", music: "LuMusic",
    brief: "LuBriefcase", search: "LuSearch", layers: "LuLayers", train: "LuTrainFront",
  };
  for (const [k, n] of Object.entries(needs)) I[k] = await icon(n, HEX.accent1);
  I.checkGreen = await icon("LuCircleCheck", HEX.accent2);
  I.chatW = await icon("LuMessagesSquare", "FFFFFF");
  I.scaleW = await icon("LuScale", "FFFFFF");
  I.calW = await icon("LuCalendarCheck", "FFFFFF");
  I.phoneW = await icon("LuSmartphone", "FFFFFF");
  const LOGO_BLUE = await svgPng(logoSvg(HEX.accent1, "FFFFFF"));
  const LOGO_WHITE = await svgPng(logoSvg("FFFFFF", HEX.accent1));
  const QR = "image/png;base64," + (await QRCode.toBuffer(DEMO_URL + "/demo", { margin: 1, width: 800, color: { dark: "#12163A", light: "#FFFFFF" } })).toString("base64");

  // 1 ── 표지 ─────────────────────────────────────────────
  pres.addSection({ title: "시작" });
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "시작" });
    s.addImage({ data: LOGO_WHITE, x: 0.8, y: 1.15, w: 0.95, h: 0.95, altText: "싱클 로고" });
    T(s, "국민대학교 KCC AI Agent 미니 캡스톤", { x: 0.8, y: 2.45, w: 6.6, h: 0.35, fontSize: 15, bold: true, color: SOFT });
    T(s, "싱클 Syncle", { x: 0.8, y: 2.85, w: 6.6, h: 1.0, fontSize: 54, bold: true, color: WHITE });
    T(s, "팀 대화를 AI가 읽고, 회의 시간 · 장소 · 안건을 정리해 제안하는 협업툴", { x: 0.8, y: 3.95, w: 6.4, h: 0.4, fontSize: 15, color: SOFT });
    T(s, "윤희원 · 김현규 · 김지우 · 박성하 · 정현서", { x: 0.8, y: 6.35, w: 6.6, h: 0.35, fontSize: 14, color: SOFT });
    // 휴대폰 목업 (mockup.js로 만든 그림: 데모 대화방 · 확정된 회의 카드)
    const mh = 5.7, mw = mh * (960 / 1868);
    s.addImage({ path: SHOT("mock-chat"), x: 7.3, y: 0.75, w: mw, h: mh, altText: "싱클 대화방 화면 · AI 회의 제안 카드" });
    s.addImage({ path: SHOT("mock-meeting"), x: 10.0, y: 1.35, w: mw, h: mh, altText: "싱클 확정된 회의 카드 화면" });
    s.addNotes("[약 10초]\n안녕하세요. 팀 대화를 AI가 읽고 회의 시간과 장소를 정리해 주는 협업툴, 싱클입니다.");
  }
  // 2 ── 팀원 소개 ───────────────────────────────────────
  pres.addSection({ title: "프로젝트 소개" });
  {
    const s = content("프로젝트 소개", "01  팀원 소개", "다섯 명이 함께 기획하고, 화면과 백엔드를 나눠 만들었습니다");
    // 왼쪽 묶음 = 프론트엔드 1명, 오른쪽 묶음 = 백엔드 4명. 카드 위에 캐릭터, 아래에 내용
    const CH = (k) => path.join(__dirname, "chars", k + ".png");
    const member = (x, y, w, h, [img, name, dept, role, lines]) => {
      box(s, { x, y, w, h, fill: { color: TINT } });
      const a = 1.25;
      s.addImage({ path: CH(img), x: x + (w - a) / 2, y: y + 0.28, w: a, h: a, altText: name + " 캐릭터" });
      T(s, name, { x: x + 0.15, y: y + 1.68, w: w - 0.3, h: 0.42, fontSize: 21, bold: true, align: "center" });
      T(s, dept, { x: x + 0.15, y: y + 2.1, w: w - 0.3, h: 0.3, fontSize: 12, color: MUTED, align: "center" });
      T(s, role, { x: x + 0.15, y: y + 2.58, w: w - 0.3, h: 0.36, fontSize: 15, bold: true, color: BLUE, align: "center" });
      T(s, lines, { x: x + 0.15, y: y + 3.05, w: w - 0.3, h: 1.2, fontSize: 13, color: INK, align: "center", paraSpaceAfter: 5 });
    };
    const gy = 1.9, cy = 2.32, ch = 4.4;
    T(s, "프론트엔드 · 디자인", { x: 0.6, y: gy, w: 2.5, h: 0.32, fontSize: 14, bold: true, color: MUTED });
    member(0.6, cy, 2.45, ch, ["yoon", "윤희원", "스마트경험디자인학과", "웹앱 · 전체 통합", "서비스 기획 · 디자인\nNext.js 웹앱\n백엔드 통합 · 배포"]);
    T(s, "백엔드", { x: 3.45, y: gy, w: 3, h: 0.32, fontSize: 14, bold: true, color: MUTED });
    const back = [
      ["kimhg", "김현규", "신소재공학부", "장소 추천", "카카오 장소 검색\n대중교통 · 도보 시간\n공평성 순위"],
      ["kimjw", "김지우", "전자공학부", "일정 · 통합", "시간 후보 계산\n응답 · 확정 저장\n제안 DB 함수"],
      ["park", "박성하", "국제통상학과", "AI 조건 추출", "Gemini 대화 이해\n회의 조건 구조화\n근거 인용 검사"],
      ["jung", "정현서", "기계공학부", "공통 시스템", "Google 로그인\n팀 · 대화 DB · 권한\n알림 · 파일 보관"],
    ];
    back.forEach((m, i) => member(3.45 + i * 2.37, cy, 2.18, ch, m));
    s.addNotes("[약 15초]\n기획은 다섯 명이 함께 했고, 프론트엔드는 저 윤희원, 백엔드는 김현규 · 김지우 · 박성하 · 정현서가 나눠 만들었습니다.");
  }
  // 공감 ── 이런 대화 본 적 있으시죠? ───────────────────────────
  {
    const s = content("프로젝트 소개", "02  문제 정의", "여러분, 이런 단톡방 본 적 있으시죠?");
    // 왼쪽: 흔한 팀플 단톡방 (예시 대화)
    box(s, { x: 0.6, y: 1.9, w: 5.75, h: 4.85, fill: { color: TINT } });
    T(s, "팀플 단톡방 (5명)", { x: 0.9, y: 2.05, w: 4, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    const chat = [
      [1, "", "다음 주에 한 번 모여야 할 것 같은데\n다들 언제 돼요?"],
      [0, "민수", "저 화요일 빼고 다 돼요"],
      [0, "지우", "저는 주말만 돼요.."],
      [0, "서연", "목요일 저녁은 알바라서 안 돼요"],
      [2, "", "— 다음 날 —"],
      [1, "", "그럼 투표 올릴게요! 장소는 어디로 해요?"],
      [0, "민수", "저 집이 좀 멀어서 ㅠㅠ"],
    ];
    let cy = 2.45;
    chat.forEach(([me, who, t]) => {
      const lines = t.split("\n").length, bh = 0.24 * lines + 0.18;
      if (me === 2) {
        T(s, t, { x: 0.9, y: cy, w: 5.15, h: 0.26, fontSize: 11, color: MUTED, align: "center" });
        cy += 0.36;
        return;
      }
      const longest = Math.max(...t.split("\n").map((l) => l.length));
      const bw = Math.min(4.3, longest * 0.155 + 0.4);
      if (me) {
        box(s, { x: 6.05 - bw, y: cy, w: bw, h: bh, fill: { color: BLUE }, rectRadius: 0.16 });
        T(s, t, { x: 6.05 - bw + 0.2, y: cy, w: bw - 0.3, h: bh, fontSize: 12.5, color: WHITE, valign: "middle" });
      } else {
        T(s, who, { x: 0.9, y: cy + 0.06, w: 0.6, h: 0.28, fontSize: 11, bold: true, color: MUTED });
        box(s, { x: 1.5, y: cy, w: bw, h: bh, fill: { color: WHITE }, rectRadius: 0.16 });
        T(s, t, { x: 1.7, y: cy, w: bw - 0.3, h: bh, fontSize: 12.5, valign: "middle" });
      }
      cy += bh + 0.13;
    });
    T(s, "아직 1명이 읽지 않았어요", { x: 0.9, y: 6.3, w: 5.15, h: 0.28, fontSize: 11, color: ORANGE, bold: true, align: "right" });
    // 오른쪽: 공감 질문
    T(s, "이런 경험, 한 번쯤 있으시죠?", { x: 6.85, y: 1.9, w: 5.8, h: 0.42, fontSize: 19, bold: true });
    const yes = [
      ["\"언제 돼요?\" 묻고 답장을 며칠 기다린 적", "답이 드문드문 와서 대화를 몇 번이나 올려 봤다"],
      ["결국 한 사람이 표로 정리한 적", "팀장 · 총무가 시간을 대조하고 다시 공지했다"],
      ["한 명이 답이 없어 확정을 못 한 적", "읽음 표시만 보며 기다렸다"],
      ["장소가 누군가에게만 멀었던 적", "\"저 집이 좀 멀어서…\" 하고 미안해했다"],
    ];
    yes.forEach(([h, d], i) => {
      const y = 2.55 + i * 0.92;
      s.addImage({ data: I.checkGreen, x: 6.85, y: y + 0.04, w: 0.34, h: 0.34 });
      T(s, h, { x: 7.35, y, w: 5.35, h: 0.38, fontSize: 16, bold: true });
      T(s, d, { x: 7.35, y: y + 0.4, w: 5.35, h: 0.3, fontSize: 13, color: MUTED });
    });
    box(s, { x: 6.85, y: 6.2, w: 5.85, h: 0.55, fill: { color: SOFT } });
    T(s, "회의는 1시간인데, 회의를 잡는 데는 며칠이 걸립니다", { x: 7.05, y: 6.2, w: 5.6, h: 0.55, fontSize: 15, bold: true, color: BLUE, valign: "middle" });
    s.addNotes("[약 20초]\n여러분, 이런 단톡방 본 적 있으시죠? '언제 돼요?'에 답이 며칠씩 걸리고, 결국 한 사람이 표로 정리하고, 장소는 누군가에게만 멉니다. 회의는 한 시간인데, 잡는 데는 며칠이 걸립니다.");
  }
  // 3 ── 문제 정의 ───────────────────────────────────────
  {
    const s = content("프로젝트 소개", "02  문제 정의", "회의보다 회의를 잡는 과정이 더 오래 걸립니다");
    const steps = ["단체 채팅에\n\"언제 돼요?\"", "답장이 며칠에\n걸쳐 드문드문", "가능한 시간을\n표로 대조", "투표 도구로\n다시 확인", "지도 앱에서\n장소 찾기", "공지하고 각자\n캘린더에 입력"];
    const cw = 2.0;
    steps.forEach((t, i) => {
      const cx = 0.6 + cw / 2 + i * 2.02;
      if (i < steps.length - 1) s.addShape(pres.shapes.LINE, { x: cx + 0.33, y: 2.27, w: 2.02 - 0.66, h: 0, line: { color: LINE, width: 1.25 } });
      s.addShape(pres.shapes.OVAL, { x: cx - 0.3, y: 1.97, w: 0.6, h: 0.6, fill: { color: i === 5 ? BLUE : SOFT }, line: { type: "none" } });
      T(s, String(i + 1).padStart(2, "0"), { x: cx - 0.3, y: 1.97, w: 0.6, h: 0.6, fontSize: 14, bold: true, color: i === 5 ? WHITE : BLUE, align: "center", valign: "middle" });
      T(s, t, { x: cx - cw / 2, y: 2.72, w: cw, h: 0.7, fontSize: 14, align: "center" });
    });
    const pains = [
      [I.repeat, "반복 조율", "답장을 모아 다시 대조하고\n빠진 사람에게 또 묻는다"],
      [I.users, "한 사람에게 집중", "팀장 · 총무가 맡지만\n인정받지 못하는 숨은 노동"],
      [I.layers, "정보 분산", "메신저 · 투표 · 지도 · 캘린더를\n오가며 같은 내용을 옮긴다"],
      [I.scale, "이동 부담 격차", "정하는 사람 근처로 잡혀\n누군가는 1시간 넘게 이동한다"],
    ];
    const pw = 2.9, pg = 0.17;
    pains.forEach(([img, h, d], i) => {
      const x = 0.6 + i * (pw + pg), y = 3.85;
      box(s, { x, y, w: pw, h: 2.25, fill: { color: TINT } });
      iconTile(s, img, x + 0.3, y + 0.3, 0.55, WHITE);
      T(s, h, { x: x + 0.3, y: y + 1.0, w: pw - 0.5, h: 0.4, fontSize: 18, bold: true });
      T(s, d, { x: x + 0.3, y: y + 1.45, w: pw - 0.55, h: 0.7, fontSize: 13, color: MUTED });
    });
    T(s, "필요한 정보(시간 · 위치 · 목적)는 이미 대화에 있지만, 그것을 결정으로 바꾸는 일은 사람이 손으로 하고 있습니다", { x: 0.6, y: 6.32, w: 12.1, h: 0.4, fontSize: 15, bold: true, color: BLUE });
    s.addNotes("[약 15초]\n정리하면, 시간 · 위치 · 목적은 이미 대화에 다 있는데, 그걸 결정으로 바꾸는 일을 팀장 한 사람이 손으로 하고 있습니다.");
  }
  // 4 ── 기존 도구 비교 ─────────────────────────────────────
  pres.addSection({ title: "차별성" });
  {
    const s = content("차별성", "03  차별성", "기존 도구는 하나씩만 풀고, 정리는 사람이 합니다");
    const head = (t, hi) => ({ text: t, options: { bold: true, fontSize: 15, color: hi ? WHITE : INK, fill: { color: hi ? BLUE : TINT }, align: "center" } });
    const mark = (sym, note, hi) => ({
      text: [
        { text: sym + "  ", options: { bold: true, color: sym === "●" ? (hi ? BLUE : GREEN) : sym === "△" ? ORANGE : LINE, fontSize: 15 } },
        { text: note, options: { color: hi ? INK : MUTED, bold: !!hi, fontSize: 13 } },
      ],
      options: { fill: { color: hi ? SOFT : WHITE }, align: "left" },
    });
    const lab = (t) => ({ text: t, options: { bold: true, fontSize: 15 } });
    const rows = [
      [{ text: "", options: { fill: { color: TINT } } }, head("메신저"), head("일정 투표 도구"), head("AI 캘린더 도구"), head("중간지점 서비스"), head("싱클", true)],
      [lab("대화에서 조건 모으기"), mark("△", "사람이 직접"), mark("–", ""), mark("–", ""), mark("–", ""), mark("●", "AI가 대화에서", true)],
      [lab("가능한 시간 정리"), mark("–", ""), mark("●", "각자 입력"), mark("●", "모두 캘린더 연동"), mark("–", ""), mark("●", "후보 누르면 끝", true)],
      [lab("공평한 장소"), mark("–", ""), mark("–", ""), mark("–", ""), mark("△", "가운데 좌표"), mark("●", "사람별 이동시간", true)],
      [lab("회의 목적 · 안건"), mark("△", "대화에 묻힘"), mark("–", ""), mark("△", "일정 제목"), mark("–", ""), mark("●", "제안에 함께", true)],
      [lab("확정 · 공유 · 캘린더"), mark("△", "공지 다시 작성"), mark("–", ""), mark("●", "초대 발송"), mark("–", ""), mark("●", "대화방 카드", true)],
    ];
    s.addTable(rows, { x: 0.6, y: 1.95, w: 12.1, colW: [2.45, 1.85, 1.85, 2.05, 1.85, 2.05], rowH: [0.55, 0.68, 0.68, 0.68, 0.68, 0.68], valign: "middle", margin: [0, 0.12, 0, 0.15], border: { type: "solid", pt: 1, color: "E3E6EF" }, fontSize: 14, color: INK });
    T(s, "싱클은 '언제 · 어디서 · 무엇을'을 팀이 대화하는 곳에서 한 번에 풉니다 · 캘린더를 모두 연동하지 않아도 됩니다", { x: 0.6, y: 6.32, w: 9.0, h: 0.4, fontSize: 15, bold: true, color: BLUE });
    T(s, "●  된다    △  일부    –  안 된다", { x: 9.7, y: 6.36, w: 3.0, h: 0.3, fontSize: 11, color: MUTED, align: "right" });
    s.addNotes("[약 20초]\n기존 도구는 하나씩만 풉니다. 투표 도구는 각자 입력해야 하고, AI 캘린더는 모두 연동해야 하고, 중간지점 서비스는 가운데 좌표만 봅니다. 싱클은 대화하는 곳에서 한 번에 풉니다.");
  }
  // 5 ── 컨셉 · 차별점 3가지 ──────────────────────────────────
  {
    const s = content("차별성", "03  차별성", "대화만 하면 AI가 제안하고, 결정은 사람이 합니다");
    const cards = [
      [I.chat, "입력하지 않는 일정 조율", "대화 속 \"목요일은 안 돼요\"와\n내 정보의 '매주 안 되는 시간'을\nAI가 모읍니다. 팀원은 나온\n후보를 누르기만 하면 끝."],
      [I.scale, "목적에 맞는 공평한 장소", "합주면 합주실, 회의면 스터디룸.\n출발지 가운데 역 3곳에서 찾고\n사람별 대중교통 시간 차이가\n작은 순으로 추천합니다."],
      [I.eye, "근거를 보여주는 AI", "몇 개의 메시지를 근거로 했는지,\n누가 부탁했는지, 확정을 왜\n아직 못 누르는지까지\n화면에 보여 줍니다."],
    ];
    const w = 3.9, g = 0.2;
    cards.forEach(([img, h, d], i) => {
      const x = 0.6 + i * (w + g), y = 1.95;
      box(s, { x, y, w, h: 3.55, fill: { color: TINT } });
      iconTile(s, img, x + 0.35, y + 0.35, 0.65, WHITE);
      T(s, String(i + 1).padStart(2, "0"), { x: x + w - 1.0, y: y + 0.38, w: 0.65, h: 0.5, fontSize: 22, bold: true, color: LINE, align: "right" });
      T(s, h, { x: x + 0.35, y: y + 1.25, w: w - 0.6, h: 0.45, fontSize: 19, bold: true });
      T(s, d, { x: x + 0.35, y: y + 1.8, w: w - 0.65, h: 1.6, fontSize: 14, color: MUTED, lineSpacingMultiple: 1.15 });
    });
    const pr = [["자동 확정 없음", "확정은 방장만"], ["지어내지 않음", "모르는 정보는 빼고 밝힘"], ["일만 모인 팀 공간", "카톡 속 일상과 분리"]];
    box(s, { x: 0.6, y: 5.75, w: 12.1, h: 0.9, fill: { color: SOFT } });
    pr.forEach(([a, b], i) => {
      T(s, [{ text: a, options: { bold: true, color: BLUE } }, { text: "  " + b, options: { color: INK } }], { x: 0.95 + i * 4.03, y: 5.75, w: 3.8, h: 0.9, fontSize: 15, valign: "middle" });
    });
    s.addNotes("[약 20초]\n차별점은 세 가지입니다. 따로 입력하지 않는 일정 조율, 사람별 이동시간으로 고르는 공평한 장소, 근거를 보여주는 AI. 그리고 카톡과 달리 일만 모인 팀 공간이라, AI가 사적인 대화를 읽지 않습니다.");
  }
  // 6 ── 서비스 흐름 ───────────────────────────────────────
  pres.addSection({ title: "구현 과정과 기술" });
  {
    const s = content("구현 과정과 기술", "04  서비스 흐름", "평소 대화에서 회의 확정까지 8단계");
    const st = [
      ["팀원끼리 대화", "평소처럼 이야기\n\"목요일은 안 돼요\"", false],
      ["@AI 회의 잡아줘", "누구나 · 대화방에서\n목적 · 기간 · 마감 확인", false],
      ["AI 조건 추출", "B · Gemini\n사람별 시간 · 장소 종류", true],
      ["시간 후보 3개", "C · 가능 인원 많은 순\n대화방에 제안 카드", true],
      ["되는 시간 응답", "팀원 · 카드 누르기\n방장은 '다시 알림'", false],
      ["장소 찾기", "D · 가운데 역 3곳\n사람별 이동시간 순위", true],
      ["방장이 확정", "시간 + 순위 있는 장소\n대화방 확정 카드", false],
      ["회의 카드 · 회의록", "캘린더 · 길찾기 · 예약\n회의 뒤 할 일까지", false],
    ];
    const w = 2.75, h = 1.45, g = 0.35, x0 = 0.64, yA = 1.95, yB = 4.05;
    const pos = (i) => (i < 4 ? { x: x0 + i * (w + g), y: yA } : { x: x0 + (7 - i) * (w + g), y: yB });
    st.forEach(([n, d, ai], i) => {
      const { x, y } = pos(i);
      box(s, { x, y, w, h, fill: { color: ai ? SOFT : WHITE }, line: ai ? { color: BLUE, width: 2 } : { color: LINE, width: 1 } });
      s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y + 0.22, w: 0.4, h: 0.4, fill: { color: ai ? BLUE : NAVY }, line: { type: "none" } });
      T(s, String(i + 1), { x: x + 0.22, y: y + 0.22, w: 0.4, h: 0.4, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, n, { x: x + 0.72, y: y + 0.22, w: w - 0.85, h: 0.4, fontSize: 16, bold: true, valign: "middle" });
      T(s, d, { x: x + 0.22, y: y + 0.75, w: w - 0.4, h: 0.62, fontSize: 12.5, color: MUTED });
    });
    for (let i = 0; i < 3; i++) arrow(s, x0 + i * (w + g) + w + 0.04, yA + h / 2, g - 0.08, 0);
    arrow(s, x0 + 3 * (w + g) + w / 2, yA + h + 0.04, 0, yB - yA - h - 0.08);
    for (let i = 0; i < 3; i++) arrow(s, x0 + i * (w + g) + w + 0.04, yB + h / 2, g - 0.08, 0, { flipH: true });
    box(s, { x: 0.64, y: 5.85, w: 0.3, h: 0.3, fill: { color: SOFT }, line: { color: BLUE, width: 2 }, rectRadius: 0.05 });
    T(s, "AI · 코드가 계산", { x: 1.05, y: 5.85, w: 2.0, h: 0.3, fontSize: 12, color: MUTED, valign: "middle" });
    box(s, { x: 3.2, y: 5.85, w: 0.3, h: 0.3, fill: { color: WHITE }, line: { color: LINE, width: 1 }, rectRadius: 0.05 });
    T(s, "사람이 정하거나 누름", { x: 3.6, y: 5.85, w: 2.4, h: 0.3, fontSize: 12, color: MUTED, valign: "middle" });
    T(s, "사람은 대화하고 · 부탁하고 · 누르고 · 확정합니다. 조건 정리 · 시간 계산 · 장소 순위는 AI와 코드가 맡습니다.", { x: 0.64, y: 6.32, w: 12.1, h: 0.4, fontSize: 15, bold: true, color: BLUE });
    s.addNotes("[약 25초]\n평소처럼 대화하다 '@AI 회의 잡아줘'라고 하면, AI가 대화에서 조건을 뽑고 시간 후보 세 개를 올립니다. 팀원은 되는 시간을 누르기만 하고, 방장이 장소를 찾아 확정하면 회의 카드와 회의록까지 이어집니다.");
  }
  // 8 ── AI 활용 ─────────────────────────────────────────
  {
    const s = content("구현 과정과 기술", "05  AI 활용", "Gemini가 흩어진 대화를 회의 조건으로 바꿉니다");
    box(s, { x: 0.6, y: 1.95, w: 4.75, h: 3.35, fill: { color: TINT } });
    T(s, "팀 대화", { x: 0.85, y: 2.1, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    const msgs = [["지우", "저 다음 주 목요일은 안 돼요"], ["민수", "주말은 오후만 돼요"], ["서연", "노트북 가져와서 같이 작업해요"]];
    msgs.forEach(([who, t], i) => {
      const y = 2.48 + i * 0.6;
      T(s, who, { x: 0.85, y: y + 0.08, w: 0.6, h: 0.3, fontSize: 12, bold: true, color: MUTED });
      box(s, { x: 1.45, y, w: 3.65, h: 0.46, fill: { color: WHITE }, rectRadius: 0.2 });
      T(s, t, { x: 1.62, y, w: 3.4, h: 0.46, fontSize: 13, valign: "middle" });
    });
    box(s, { x: 2.45, y: 4.38, w: 2.65, h: 0.46, fill: { color: BLUE }, rectRadius: 0.2 });
    T(s, "@AI 회의 잡아줘", { x: 2.45, y: 4.38, w: 2.65, h: 0.46, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" });
    arrow(s, 5.45, 3.62, 0.62, 0, { line: { color: BLUE, width: 2, endArrowType: "triangle" } });
    T(s, "Gemini", { x: 5.25, y: 3.2, w: 1.0, h: 0.3, fontSize: 11, bold: true, color: BLUE, align: "center" });
    box(s, { x: 6.2, y: 1.95, w: 6.5, h: 3.35, fill: { color: NAVY } });
    T(s, "회의 조건 (JSON)", { x: 6.45, y: 2.1, w: 4, h: 0.3, fontSize: 12, bold: true, color: SOFT });
    const code = [
      ["purpose", "\"중간발표 자료 역할 분담\""],
      ["meetingMode", "\"offline\""],
      ["placeType", "\"회의 장소\""],
      ["지우", "unavailable · 11/12(목) 종일"],
      ["민수", "available · 토 · 일 12:00 이후"],
      ["agenda", "[\"노트북으로 같이 작업\"]"],
      ["sourceMessageIds", "[메시지 3개]"],
    ];
    code.forEach(([k, v], i) => {
      T(s, [{ text: k, options: { color: "9FB0FF", fontFace: "Courier New" } }, { text: "   " + v, options: { color: WHITE } }], { x: 6.45, y: 2.5 + i * 0.38, w: 6.1, h: 0.34, fontSize: 13, valign: "middle" });
    });
    const rowChips = (label, items, y) => {
      T(s, label, { x: 0.6, y, w: 1.55, h: 0.42, fontSize: 14, bold: true, valign: "middle" });
      let x = 2.2;
      items.forEach((t) => {
        const w = t.length * 0.15 + 0.4;
        box(s, { x, y, w, h: 0.42, fill: { color: SOFT }, rectRadius: 0.21 });
        T(s, t, { x, y, w, h: 0.42, fontSize: 13, color: BLUE, bold: true, align: "center", valign: "middle" });
        x += w + 0.15;
      });
    };
    rowChips("AI가 맡는 일", ["회의 조건", "대화 요약", "할 일 정리", "자료 정리", "회의록"], 5.55);
    rowChips("검증 · 보정", ["분 단위로 맞춤", "기간 밖은 자름", "겹치는 시간 정리", "근거 인용 검사", "지어내기 금지"], 6.15);
    s.addNotes("[약 25초]\nGemini가 '목요일은 안 돼요' 같은 말을 사람별 시간 조건과 장소 종류로 바꿔 정해진 JSON으로 돌려줍니다. 시간 계산과 순위는 AI가 아니라 코드가 맡아서, 숫자가 틀리지 않게 했습니다.");
  }
  // AI 시험 ───────────────────────────────────────────
  {
    const s = content("구현 과정과 기술", "05  AI 시험과 개선", "실제 팀 대화로 시험하고, 틀리는 곳을 코드로 막았습니다");
    box(s, { x: 0.6, y: 1.95, w: 4.7, h: 4.75, fill: { color: TINT } });
    T(s, "실제 팀 대화로 회의 조건 추출 시험", { x: 0.9, y: 2.15, w: 4.2, h: 0.35, fontSize: 14, bold: true });
    T(s, "보정 전", { x: 0.9, y: 2.75, w: 1.8, h: 0.3, fontSize: 13, color: MUTED, bold: true });
    T(s, [{ text: "1", options: { fontSize: 54, bold: true, color: MUTED } }, { text: " / 4회", options: { fontSize: 20, bold: true, color: MUTED } }], { x: 0.9, y: 3.05, w: 2.0, h: 0.95, valign: "middle" });
    arrow(s, 2.75, 3.55, 0.55, 0, { line: { color: BLUE, width: 2, endArrowType: "triangle" } });
    T(s, "보정 후", { x: 3.45, y: 2.75, w: 1.8, h: 0.3, fontSize: 13, color: BLUE, bold: true });
    T(s, [{ text: "8", options: { fontSize: 54, bold: true, color: BLUE } }, { text: " / 8회", options: { fontSize: 20, bold: true, color: BLUE } }], { x: 3.45, y: 3.05, w: 1.8, h: 0.95, valign: "middle" });
    T(s, "AI가 낸 조건이 검사를 통과해\n시간 후보까지 만들어진 횟수", { x: 0.9, y: 4.2, w: 4.2, h: 0.6, fontSize: 13, color: MUTED });
    box(s, { x: 0.9, y: 5.05, w: 4.1, h: 1.35, fill: { color: WHITE } });
    T(s, "사용 모델", { x: 1.1, y: 5.18, w: 3.7, h: 0.3, fontSize: 12, bold: true, color: MUTED });
    T(s, "Gemini 3.1 Flash-Lite", { x: 1.1, y: 5.48, w: 3.7, h: 0.38, fontSize: 17, bold: true });
    T(s, "무료 한도 안에서 빠른 응답 · 답은 정해진 JSON 형식으로", { x: 1.1, y: 5.88, w: 3.8, h: 0.4, fontSize: 12, color: MUTED });
    T(s, "찾아낸 실패와 고친 방법", { x: 5.7, y: 1.95, w: 7, h: 0.35, fontSize: 15, bold: true });
    const fx = [
      ["AI가 끝 시각을 23:59:59로 씀", "분 단위로 맞춤 (다음 날 00:00)"],
      ["찾는 기간 밖 날짜가 섞임", "모든 시간을 찾는 기간 안으로 자름"],
      ["같은 사람의 되는 · 안 되는 시간이 겹침", "겹친 부분은 되는 시간에서 뺌"],
      ["'하루 종일 가능'을 0시로 이해 → 한밤중 후보", "매일 가능 시간(09~22시) 추가"],
      ["요약 · 할 일에 대화에 없는 내용", "근거 메시지 인용 검사 · 지어내기 금지"],
    ];
    fx.forEach(([a, b], i) => {
      const y = 2.45 + i * 0.86;
      box(s, { x: 5.7, y, w: 7.0, h: 0.72, fill: { color: WHITE }, line: { color: "E3E6EF", width: 1 } });
      T(s, a, { x: 5.95, y, w: 3.3, h: 0.72, fontSize: 13, valign: "middle" });
      arrow(s, 9.3, y + 0.36, 0.3, 0, { line: { color: LINE, width: 1.25, endArrowType: "triangle" } });
      T(s, b, { x: 9.72, y, w: 2.9, h: 0.72, fontSize: 13, bold: true, color: BLUE, valign: "middle" });
    });
    s.addNotes("[약 20초]\n실제 팀 대화로 시험해 보니 처음에는 4번 중 1번만 성공했습니다. 23시 59분 같은 시각, 기간 밖 날짜, 한밤중 후보 같은 실패를 찾아 코드로 막았고, 그 뒤 8번 중 8번 성공했습니다.");
  }
  // 9 ── 공평한 장소 알고리즘 ─────────────────────────────────
  {
    const s = content("구현 과정과 기술", "05  핵심 알고리즘", "가장 먼 한 사람보다, 사람 간 차이를 줄입니다");
    const rules = [
      ["후보 지역 3곳", "출발지 가운데에서 가까운 지하철역 3곳(서로 1.5km 이상),\n역 1km 안에서 AI가 고른 장소 종류를 찾음"],
      ["1시간 넘는 사람이 있으면 제외", "장소마다 사람별 대중교통 시간, 가까우면 도보 시간"],
      ["사람 간 차이가 작은 순", "최장 − 최단이 작은 순, 같으면 가장 오래 걸리는 사람이 짧은 순"],
      ["모르는 사람은 빼고 비교", "출발지가 없는 팀원은 빼고 아는 사람(2명 이상)끼리,\n화면에 '미확인 N명 빼고 계산' 표시"],
    ];
    rules.forEach(([h, d], i) => {
      const y = 1.95 + i * 1.12;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.05, w: 0.48, h: 0.48, fill: { color: BLUE }, line: { type: "none" } });
      T(s, String(i + 1), { x: 0.6, y: y + 0.05, w: 0.48, h: 0.48, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle" });
      T(s, h, { x: 1.3, y, w: 4.6, h: 0.4, fontSize: 17, bold: true });
      T(s, d, { x: 1.3, y: y + 0.42, w: 4.55, h: 0.62, fontSize: 13, color: MUTED });
    });
    // 오른쪽: 예시 (사람별 이동시간 점 + 범위 막대)
    const px = 6.3, py = 1.95, pw = 6.4, ph = 4.75;
    box(s, { x: px, y: py, w: pw, h: ph, fill: { color: TINT } });
    T(s, "예시 · 팀원 4명의 대중교통 시간 (분)", { x: px + 0.3, y: py + 0.22, w: 5.5, h: 0.35, fontSize: 14, bold: true });
    const X0 = 8.0, X1 = 12.35, MAX = 70, xs = (m) => X0 + ((X1 - X0) * m) / MAX;
    const places = [
      ["A 스터디카페", [22, 28, 31, 35], "1위 · 차이 13분", BLUE],
      ["B 스터디룸", [18, 24, 38, 44], "2위 · 차이 26분", BLUE],
      ["C 회의실", [12, 20, 47, 68], "제외 · 68분 > 1시간", ORANGE],
    ];
    const top = py + 1.0, rowH = 0.92, axisY = top + 3 * rowH;
    for (const m of [0, 20, 40, 60]) {
      s.addShape(pres.shapes.LINE, { x: xs(m), y: top - 0.15, w: 0, h: axisY - top + 0.1, line: { color: m === 60 ? ORANGE : "D9DDE8", width: m === 60 ? 1.5 : 0.75, dashType: m === 60 ? "dash" : "solid" } });
      T(s, m === 60 ? "60 (1시간)" : String(m), { x: xs(m) - 0.6, y: axisY + 0.02, w: 1.2, h: 0.28, fontSize: 11, color: m === 60 ? ORANGE : MUTED, align: "center", bold: m === 60 });
    }
    places.forEach(([name, mins, res, col], i) => {
      const cy = top + i * rowH + 0.32;
      T(s, name, { x: px + 0.3, y: cy - 0.3, w: 1.6, h: 0.32, fontSize: 13, bold: true });
      T(s, res, { x: px + 0.3, y: cy + 0.02, w: 1.65, h: 0.32, fontSize: 11, bold: true, color: col });
      const lo = Math.min(...mins), hi = Math.max(...mins);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: xs(lo), y: cy - 0.07, w: xs(hi) - xs(lo), h: 0.14, rectRadius: 0.07, fill: { color: col, transparency: 70 }, line: { type: "none" } });
      mins.forEach((m) => s.addShape(pres.shapes.OVAL, { x: xs(m) - 0.09, y: cy - 0.09, w: 0.18, h: 0.18, fill: { color: col }, line: { color: WHITE, width: 1 } }));
    });
    T(s, "A가 1위: 가장 먼 사람(35분)도 짧고, 사람 간 차이(13분)도 가장 작습니다", { x: px + 0.3, y: py + ph - 0.55, w: pw - 0.6, h: 0.35, fontSize: 13, bold: true, color: BLUE });
    s.addNotes("[약 25초]\n장소는 출발지 가운데 역 세 곳에서 찾습니다. 한 명이라도 1시간이 넘으면 빼고, 사람 간 이동시간 차이가 작은 순으로 추천합니다. 예시에서는 A가 차이 13분으로 1위입니다.");
  }
  // 10 ── 화면 1 ─────────────────────────────────────────
  const screens = (s, list, label) => {
    const h = 4.25, cols = [2.62, 6.67, 10.72];
    list.forEach(([name, t, d], i) => {
      const w = h * (764 / 1672), cx = cols[i];
      phone(s, name, cx - w / 2, 1.82, h, t);
      T(s, t, { x: cx - 2.0, y: 6.18, w: 4.0, h: 0.32, fontSize: 15, bold: true, align: "center" });
      T(s, d, { x: cx - 2.0, y: 6.5, w: 4.0, h: 0.3, fontSize: 12, color: MUTED, align: "center" });
    });
    T(s, label, { x: 7.7, y: 0.42, w: 5.0, h: 0.32, fontSize: 11, color: MUTED, align: "right", valign: "middle" });
  };
  pres.addSection({ title: "결과물과 시연" });
  {
    const s = content("결과물과 시연", "06  결과물", "실제로 동작하는 화면입니다");
    screens(s, [
      ["live-chat", "대화방 · AI 요약 카드", "팀원 모두에게 · 누가 부탁했는지 · 근거 수"],
      ["live-proposal", "회의 제안", "후보를 누르면 응답 끝 · 5명 모두 응답"],
      ["live-meeting", "확정된 회의 카드", "캘린더 · 길찾기 · 장소 예약 · 회의록"],
    ], "실제 로그인 화면 · 싱클 체험방 · 프로젝트 2조");
    s.addNotes("[약 20초]\n실제 로그인 화면입니다. AI 요약 카드는 팀원 모두에게 보이고, 가운데는 우리 팀 다섯 명이 실제로 응답한 제안, 오른쪽은 확정된 회의 카드입니다.");
  }
  // 11-1 ── 시연 영상 ─────────────────────────────────────
  // 영상 파일을 media/demo.mp4에 두고 다시 만들면 영상이 들어가요. 없으면 PowerPoint에서 '삽입 → 비디오'로 넣을 자리만 그려요.
  {
    const s = content("결과물과 시연", "06  시연 영상", "로그인부터 회의 카드까지, 한 번에 보여드립니다");
    const VIDEO = path.join(__dirname, "media", "demo.mp4");
    const hasVideo = require("fs").existsSync(VIDEO);
    // 휴대폰 화면 녹화(세로) 자리: 390 × 844 비율
    const vh = 5.15, vw = vh * (390 / 844), vx = 1.45, vy = 1.85;
    box(s, { x: vx - 0.18, y: vy - 0.18, w: vw + 0.36, h: vh + 0.36, fill: { color: NAVY }, rectRadius: 0.32, objectName: "영상 테두리" });
    if (hasVideo) {
      s.addMedia({ type: "video", path: VIDEO, x: vx, y: vy, w: vw, h: vh, cover: SHOT("live-chat"), objectName: "시연 영상" });
    } else {
      box(s, { x: vx, y: vy, w: vw, h: vh, fill: { color: TINT }, rectRadius: 0.16, objectName: "영상 자리" });
      s.addImage({ data: I.phone, x: vx + vw / 2 - 0.35, y: vy + vh / 2 - 0.75, w: 0.7, h: 0.7 });
      T(s, "시연 영상\n삽입 → 비디오", { x: vx + 0.15, y: vy + vh / 2 + 0.1, w: vw - 0.3, h: 0.7, fontSize: 14, bold: true, color: BLUE, align: "center" });
    }
    // 오른쪽: 영상에서 보이는 순서
    const steps = [
      [I.users, "Google 로그인 · 팀 만들기", "초대 링크로 팀원이 들어와요"],
      [I.chat, "평소처럼 대화", "'목요일은 안 돼요' · '주말은 오후만'"],
      [I.spark, "'@AI 회의 잡아줘'", "AI가 대화를 읽고 후보 3개를 올려요"],
      [I.clock, "되는 시간 누르기", "팀원은 후보를 누르기만 하면 응답 끝"],
      [I.pin, "공평한 장소 찾기 · 확정", "사람별 이동시간 차이가 작은 곳 1위"],
      [I.cal, "회의 카드", "시간 · 장소 · 안건 · 캘린더 · 길찾기"],
    ];
    const sx = 5.0, sy = 1.95, rh = 0.82;
    steps.forEach(([img, head, sub], i) => {
      const y = sy + i * rh;
      iconTile(s, img, sx, y, 0.56);
      T(s, `${i + 1}`, { x: sx + 0.75, y: y + 0.02, w: 0.35, h: 0.5, fontSize: 20, bold: true, color: BLUE, valign: "middle" });
      T(s, head, { x: sx + 1.15, y: y - 0.02, w: 4.1, h: 0.34, fontSize: 17, bold: true, valign: "middle" });
      T(s, sub, { x: sx + 1.15, y: y + 0.32, w: 4.1, h: 0.28, fontSize: 13, color: MUTED, valign: "middle" });
      if (i < steps.length - 1) arrow(s, sx + 0.28, y + 0.6, 0, rh - 0.64, { line: { color: LINE, width: 1.25, endArrowType: "triangle" } });
    });
    T(s, "실제 로그인 · 실제 데이터 · Gemini AI로 녹화했어요", { x: sx, y: sy + steps.length * rh + 0.05, w: 5.2, h: 0.32, fontSize: 12, color: MUTED });
    // 직접 해 보기 QR (데모: 로그인 → 새 팀 → 예시 대화 → @AI → 확정 → 회의 카드)
    box(s, { x: 10.45, y: 2.05, w: 2.25, h: 3.05, fill: { color: TINT }, objectName: "QR 상자" });
    s.addImage({ data: QR, x: 10.6, y: 2.2, w: 1.95, h: 1.95, altText: "싱클 데모 QR 코드" });
    T(s, "직접 해 보기", { x: 10.6, y: 4.27, w: 1.95, h: 0.3, fontSize: 14, bold: true, color: BLUE, align: "center" });
    T(s, "찍으면 로그인부터\n회의 카드까지 열려요", { x: 10.55, y: 4.58, w: 2.05, h: 0.45, fontSize: 11, color: MUTED, align: "center" });
    s.addNotes("[영상 길이만큼 · 30~40초 권장]\n(영상을 틀고) 실제로 로그인해서 팀을 만들고, 평소처럼 대화한 뒤 '@AI 회의 잡아줘'라고 부탁합니다. AI가 대화를 읽고 시간 후보를 올리면 팀원은 되는 시간을 누르기만 하고, 방장이 공평한 장소를 찾아 확정하면 회의 카드가 만들어집니다. 오른쪽 QR을 찍으시면 같은 흐름을 직접 해 보실 수 있습니다.\n\n※ 전체 5분에 맞추려면 다른 장의 대본을 영상 길이만큼 줄여야 해요.");
  }
  // 12 ── 완성도 ─────────────────────────────────────────
  {
    const s = content("결과물과 시연", "06  구현 결과 · 시연", "기획한 핵심 흐름을 실제 데이터로 끝까지 구현했습니다");
    const stats = [["38", "앱 화면", "디자인 화면 약 60개"], ["4", "백엔드 모듈 통합", "A · B · C · D"], ["211", "자동 테스트 통과", "B 196개 · C 15개"], ["약 10", "팀원 피드백 반영", "미리보기로 직접 써 보고"]];
    const w = 2.9, g = 0.17;
    stats.forEach(([n, l, d], i) => {
      const x = 0.6 + i * (w + g), y = 1.95;
      box(s, { x, y, w, h: 1.65, fill: { color: TINT } });
      T(s, n, { x: x + 0.3, y: y + 0.18, w: w - 0.5, h: 0.75, fontSize: 40, bold: true, color: BLUE });
      T(s, l, { x: x + 0.3, y: y + 0.92, w: w - 0.5, h: 0.32, fontSize: 15, bold: true });
      T(s, d, { x: x + 0.3, y: y + 1.24, w: w - 0.5, h: 0.3, fontSize: 12, color: MUTED });
    });
    T(s, "실제 데이터로 동작 · 두 계정으로 처음부터 끝까지 확인", { x: 0.6, y: 3.92, w: 12.1, h: 0.35, fontSize: 15, bold: true });
    const done = [
      "Google 로그인 · 팀 만들기 · 초대 링크", "실시간 대화 · 사진 · 파일 · 할 일",
      "AI 회의 조건 → 시간 후보 3개", "응답 · 다시 알림 · 앱 알림",
      "공평한 지역 3곳 · 사람별 이동시간", "방장 확정 · 확정 카드 · 캘린더",
      "AI 요약 · 할 일 · 자료 · 회의록", "팀 설정 · 방장 넘기기 · 내보내기",
    ];
    done.forEach((t, i) => {
      const x = 0.6 + (i % 2) * 6.1, y = 4.38 + Math.floor(i / 2) * 0.47;
      s.addImage({ data: I.checkGreen, x, y: y + 0.04, w: 0.26, h: 0.26 });
      T(s, t, { x: x + 0.38, y, w: 5.5, h: 0.34, fontSize: 14, valign: "middle" });
    });
    T(s, [{ text: "사용 기술  ", options: { bold: true, color: INK } }, { text: "Next.js · TypeScript · Supabase · Gemini API · 카카오 지도 API · Vercel", options: { color: MUTED } }], { x: 0.6, y: 6.5, w: 12.1, h: 0.3, fontSize: 12 });
    s.addNotes("[약 25초]\n앱 화면 38개, 백엔드 모듈 4개를 하나로 통합했고 자동 테스트 211개가 통과합니다. 로그인부터 확정, 회의록까지 실제 데이터로 동작합니다.");
  }
  // 14 ── 실용성 · 확장 ───────────────────────────────────
  pres.addSection({ title: "실용성과 확장" });
  {
    const s = content("실용성과 확장", "07  실용성과 확장", "매주 모이는 소규모 팀의 일을 바로 줄입니다");
    const tg = [
      [I.cap, "대학생 팀 프로젝트", "수업 · 알바 사이에서 주 1회 대면 회의, 단톡방 조율을 대신"],
      [I.music, "스터디 · 동아리 · 밴드", "합주실 · 스터디룸처럼 목적이 있는 장소를 공평하게"],
      [I.brief, "소규모 협업팀", "원격과 대면이 섞인 미팅, 온라인이면 회의 링크까지"],
    ];
    T(s, "바로 쓸 곳", { x: 0.6, y: 1.95, w: 5, h: 0.35, fontSize: 15, bold: true, color: MUTED });
    tg.forEach(([img, h, d], i) => {
      const y = 2.42 + i * 1.42;
      box(s, { x: 0.6, y, w: 5.6, h: 1.22, fill: { color: TINT } });
      iconTile(s, img, 0.85, y + 0.3, 0.62, WHITE);
      T(s, h, { x: 1.7, y: y + 0.2, w: 4.3, h: 0.38, fontSize: 17, bold: true });
      T(s, d, { x: 1.7, y: y + 0.6, w: 4.35, h: 0.5, fontSize: 13, color: MUTED });
    });
    T(s, "발전 방향", { x: 6.8, y: 1.95, w: 5, h: 0.35, fontSize: 15, bold: true, color: MUTED });
    const road = [
      ["지금", "프로토타입", "부를 때만 일하는 AI · 공평한 장소 · 확정 · 회의록까지 실제 동작"],
      ["다음", "파일럿", "실제 팀 3~5개가 2~4주 사용 · 확정까지 걸린 시간 · 응답률 측정"],
      ["이후", "확장", "대화 자동 감지 · 캘린더 빈 시간 · 리마인드 · 카톡 공유"],
    ];
    s.addShape(pres.shapes.LINE, { x: 7.12, y: 2.75, w: 0, h: 2.85, line: { color: LINE, width: 1.5 } });
    road.forEach(([a, b, d], i) => {
      const y = 2.42 + i * 1.42;
      s.addShape(pres.shapes.OVAL, { x: 6.86, y: y + 0.08, w: 0.52, h: 0.52, fill: { color: i === 0 ? BLUE : WHITE }, line: { color: BLUE, width: 1.5 } });
      T(s, [{ text: a, options: { bold: true, color: BLUE } }, { text: "  " + b, options: { bold: true, color: INK } }], { x: 7.65, y: y + 0.12, w: 5.0, h: 0.4, fontSize: 17 });
      T(s, d, { x: 7.65, y: y + 0.56, w: 5.05, h: 0.62, fontSize: 13, color: MUTED });
    });
    s.addNotes("[약 20초]\n대학생 팀플, 스터디와 밴드, 소규모 협업팀이 바로 쓸 수 있습니다. 다음은 실제 팀 파일럿, 이후에는 자동 감지와 캘린더 연동으로 넓혀 가겠습니다.");
  }
  // 16 ── 감사합니다 ─────────────────────────────────────
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "실용성과 확장" });
    s.addImage({ data: LOGO_WHITE, x: (13.333 - 1.1) / 2, y: 1.75, w: 1.1, h: 1.1, altText: "싱클 로고" });
    T(s, "감사합니다", { x: 0.8, y: 3.1, w: 11.73, h: 1.0, fontSize: 48, bold: true, color: WHITE, align: "center", valign: "middle" });
    T(s, "Q&A", { x: 0.8, y: 4.1, w: 11.73, h: 0.6, fontSize: 24, bold: true, color: SOFT, align: "center", valign: "middle" });
    T(s, "싱클 Syncle  ·  윤희원 · 김현규 · 김지우 · 박성하 · 정현서", { x: 0.8, y: 6.2, w: 11.73, h: 0.4, fontSize: 14, color: SOFT, align: "center" });
    s.addNotes("[약 3초]\n감사합니다. 질문 받겠습니다.\n\n[예상 질문]\nQ1. 기존 투표 도구나 중간지점 서비스와 무엇이 다른가요?\n→ 따로 입력하지 않아도 대화에서 조건을 모으고, 시간 · 장소 · 목적을 한 회의 안에서 확정까지 잇습니다. 장소는 가운데 좌표가 아니라 사람별 실제 대중교통 시간으로 고릅니다.\nQ2. AI가 조건을 잘못 이해하면요?\n→ 시간은 코드가 다듬고 검사합니다. 팀원은 '내 조건'에서 AI가 이해한 내용을 보고, 후보가 안 맞으면 '다른 시간 알려주기'로 고칩니다. 확정은 항상 방장이 합니다.\nQ3. 왜 '차이가 작은 순'인가요? 1시간은 근거가 있나요?\n→ 한 명만 가까운 곳보다 모두 조금씩 비슷한 곳이 공평하다고 팀에서 합의했습니다. 1시간은 지나친 이동을 먼저 거르는 기본값으로, 팀마다 바꿀 수 있게 할 계획입니다.\nQ4. 출발지를 안 넣은 사람이 있으면요?\n→ 그 사람은 빼고 아는 사람끼리 계산하고, '미확인 N명 빼고 계산'이라고 화면에 밝힙니다.\nQ5. 이미 카톡이 있는데 왜 새 앱인가요?\n→ 일과 일상이 섞이지 않는 팀 협업 공간이기 때문입니다. 회의 · 자료 · 할 일이 팀 메뉴에 모이고, AI가 사적인 대화를 읽지 않아도 됩니다. 초대 링크로 설치 없이 들어옵니다.\nQ6. 개인정보는요?\n→ 정확한 출발지는 서버만 읽고 팀원에게는 동네까지만 보입니다. 파일은 비공개 보관함, API 키는 서버에만 둡니다.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
