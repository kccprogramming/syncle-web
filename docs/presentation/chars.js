// 팀원 캐릭터 (성별 단서 없이 머리 모양 · 색만 다르게)
const sharp = require("sharp");
const skin = "F3CBAA", ink = "1F2937";
// 얼굴 뒤에 그리는 긴 머리
const backs = {
  long: (c) => `<path d="M60 96 C56 58 78 44 100 44 C122 44 144 58 140 96 L144 150 C130 158 70 158 56 150Z" fill="#${c}"/>`,
  bob: (c) => `<path d="M62 96 C58 60 80 46 100 46 C120 46 142 60 138 96 L140 128 C126 134 74 134 60 128Z" fill="#${c}"/>`,
  wavy: (c) => `<g fill="#${c}"><path d="M60 96 C56 58 78 44 100 44 C122 44 144 58 140 96 L142 140 C130 150 70 150 58 140Z"/><circle cx="58" cy="132" r="12"/><circle cx="142" cy="132" r="12"/><circle cx="62" cy="112" r="11"/><circle cx="138" cy="112" r="11"/></g>`,
  pony: (c) => `<g fill="#${c}"><path d="M62 96 C58 60 80 46 100 46 C120 46 142 60 138 96 L134 104 L66 104Z"/><path d="M132 70 C156 76 160 112 146 136 C142 116 138 98 128 86Z"/></g>`,
};
const hairs = {
  none: () => "",
  sideBang: (c) => `<path d="M66 96 C62 62 82 48 102 48 C124 48 140 62 134 92 C126 78 112 70 96 72 C86 80 76 86 66 96Z" fill="#${c}"/>`,
  straightBang: (c) => `<path d="M66 94 C64 62 84 48 100 48 C116 48 136 62 134 94 C130 86 126 82 120 80 L66 82Z" fill="#${c}"/>`,
  middle: (c) => `<path d="M66 96 C64 62 84 48 100 48 C116 48 136 62 134 96 C126 80 112 70 100 62 C88 70 74 80 66 96Z" fill="#${c}"/>`,
  fringe: (c) => `<path d="M64 96 C60 60 82 46 100 46 C122 46 142 60 136 96 C130 84 124 80 118 79 L112 70 L104 79 L96 70 L88 79 C78 80 70 86 64 96Z" fill="#${c}"/>`,
  side: (c) => `<path d="M64 98 C58 62 80 46 102 46 C124 46 142 62 136 98 C132 80 122 70 106 66 C96 74 82 82 64 98Z" fill="#${c}"/>`,
  curly: (c) => `<g fill="#${c}"><circle cx="74" cy="78" r="15"/><circle cx="90" cy="62" r="17"/><circle cx="110" cy="60" r="17"/><circle cx="127" cy="76" r="15"/><circle cx="100" cy="72" r="18"/></g>`,
  buzz: (c) => `<path d="M68 92 C66 64 84 52 100 52 C116 52 134 64 132 92 C124 80 112 74 100 74 C88 74 76 80 68 92Z" fill="#${c}"/>`,
  wave: (c) => `<path d="M64 100 C56 64 80 44 100 44 C124 44 146 62 136 100 C134 86 128 76 120 72 C112 80 104 70 96 76 C88 82 76 78 70 88 C66 92 65 96 64 100Z" fill="#${c}"/>`,
};
function svg({ bg, shirt, hair, style, glasses, back }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<defs><clipPath id="c"><circle cx="100" cy="100" r="100"/></clipPath></defs>
<g clip-path="url(#c)">
<rect width="200" height="200" fill="#${bg}"/>
${back ? backs[back](hair) : ""}
<path d="M36 210 C36 158 66 136 100 136 C134 136 164 158 164 210Z" fill="#${shirt}"/>
<rect x="90" y="118" width="20" height="24" rx="8" fill="#${skin}"/>
<path d="M88 138 L100 152 L112 138" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linejoin="round" opacity="0.8"/>
<circle cx="100" cy="94" r="34" fill="#${skin}"/>
${hairs[style](hair)}
<circle cx="88" cy="98" r="3.6" fill="#${ink}"/><circle cx="112" cy="98" r="3.6" fill="#${ink}"/>
${glasses ? `<g fill="none" stroke="#${ink}" stroke-width="2.4"><circle cx="88" cy="98" r="9"/><circle cx="112" cy="98" r="9"/><path d="M97 98 H103"/></g>` : ""}
<circle cx="80" cy="109" r="5" fill="#F29C9C" opacity="0.45"/><circle cx="120" cy="109" r="5" fill="#F29C9C" opacity="0.45"/>
<path d="M92 112 Q100 119 108 112" fill="none" stroke="#${ink}" stroke-width="3" stroke-linecap="round"/>
</g></svg>`;
}
const people = {
  yoon: { bg: "DCE2FB", shirt: "3346D3", hair: "2B2B33", back: "long", style: "sideBang" },
  kimhg: { bg: "DDF1E8", shirt: "1E9E6A", hair: "3A2A22", style: "buzz", glasses: true },
  kimjw: { bg: "FDE8D7", shirt: "E8762C", hair: "2B2B33", back: "bob", style: "straightBang" },
  park: { bg: "EDE3FA", shirt: "7C5CC4", hair: "4A3426", back: "wavy", style: "middle" },
  jung: { bg: "E3F1F8", shirt: "1C7293", hair: "2B2B33", back: "pony", style: "sideBang", glasses: true },
};
(async () => {
  for (const [k, p] of Object.entries(people)) await sharp(Buffer.from(svg(p))).resize(400, 400).png().toFile(`chars/${k}.png`);
  const { createCanvas } = {};
  console.log("ok");
})();
