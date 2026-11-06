// 앱 화면 캡처(640×960 창, 2배) → 휴대폰 목업 PNG (투명 배경)
const sharp = require("sharp");
const [, , src, out] = process.argv;
(async () => {
  const W = 780, H = 1688, R = 80;          // 화면 (390×844 @2x)
  const B = 30, OR = R + B;                  // 테두리 두께 · 바깥 둥글기
  const screen = await sharp(src).extract({ left: 250, top: 32, width: W, height: H }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${R}" fill="#fff"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const FW = W + B * 2, FH = H + B * 2, PAD = 60;
  const frame = Buffer.from(`<svg width="${FW + PAD * 2}" height="${FH + PAD * 2}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000" flood-opacity="0.35"/></filter></defs>
    <rect x="${PAD}" y="${PAD}" width="${FW}" height="${FH}" rx="${OR}" fill="#0B0E1F" filter="url(#s)"/>
    <rect x="${PAD + 3}" y="${PAD + 3}" width="${FW - 6}" height="${FH - 6}" rx="${OR - 3}" fill="none" stroke="#5A6088" stroke-width="4"/>
  </svg>`);
  await sharp(frame).composite([{ input: rounded, left: PAD + B, top: PAD + B }]).png().toFile(out);
  console.log("wrote", out);
})();
