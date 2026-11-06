# 발표 자료 (KCC AI Agent 미니 캡스톤 · 5분 발표)

- 최종본: `Syncle_발표.pptx` (15장, 대본은 각 장 노트 · 약 4분 40초). 희원 컴퓨터에는 `~/Downloads/Syncle_발표/`에도 같은 파일 + PDF가 있어요.
- 만드는 코드: `build.js` (pptxgenjs). 그림: `chars/`(팀원 캐릭터, `chars.js`로 생성) · `shots/`(앱 화면 캡처, `live-*`가 실제 로그인 화면).
- 다시 만들기 (Claude에게 "docs/presentation으로 발표 자료 고쳐줘"라고 하면 돼요):
  1. 빈 폴더에 이 폴더를 복사하고 `npm i pptxgenjs qrcode react-icons react react-dom sharp`
  2. `SKILL=<pptx 스킬 폴더> NODE_PATH=./node_modules node build.js` → `Syncle_발표.pptx`
  3. PowerPoint로 열어 PDF로 저장해 화면 점검 (위쪽으로 가는 선은 크기를 음수로 쓰면 PowerPoint가 '복구'를 띄워요 → `arrow()`가 뒤집기로 처리)
- 글꼴: Pretendard. 발표 컴퓨터에 없으면 PDF로 발표.
- QR: 미리보기 데모 `https://syncle-web-git-integration-b-d-unione1.vercel.app/teams/hci4` (로그인 없이 데모 팀, 실제 화면 모양)
- 심사 기준(실용성 30 · 참신성 30 · 완성도 20 · 기술성 20)과 발표 꿀팁 순서(팀원 → 문제 → 차별성 → 구현 · 기술 → 시연)에 맞춰 구성했어요.
