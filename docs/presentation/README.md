# 발표 자료 (KCC AI Agent 미니 캡스톤 · 5분 발표)

- 최종본: `Syncle_발표.pptx` (15장, 대본은 각 장 노트 · 약 4분 30초 + 시연 영상). 희원 컴퓨터에는 `~/Downloads/Syncle_발표/`에도 같은 파일 + PDF가 있어요.
- 만드는 코드: `build.js` (pptxgenjs). 그림: `chars/`(팀원 캐릭터, `chars.js`로 생성) · `shots/`(앱 화면 캡처, `live-*`가 실제 로그인 화면).
- 다시 만들기 (Claude에게 "docs/presentation으로 발표 자료 고쳐줘"라고 하면 돼요):
  1. 빈 폴더에 이 폴더를 복사하고 `npm i pptxgenjs qrcode react-icons react react-dom sharp`
  2. `SKILL=<pptx 스킬 폴더> NODE_PATH=./node_modules node build.js` → `Syncle_발표.pptx`
  3. PowerPoint로 열어 PDF로 저장해 화면 점검 (위쪽으로 가는 선은 크기를 음수로 쓰면 PowerPoint가 '복구'를 띄워요 → `arrow()`가 뒤집기로 처리)
- 글꼴: Pretendard. 발표 컴퓨터에 없으면 PDF로 발표.
- QR: 미리보기 데모 `https://syncle-web-git-integration-b-d-unione1.vercel.app/demo` (데모 모드로 로그인 → 새 팀 → 예시 대화 → @AI 회의 잡아줘 → 확정 → 회의 카드. 실제 Google 로그인 · Gemini 없이)
- 심사 기준(실용성 30 · 참신성 30 · 완성도 20 · 기술성 20)과 발표 꿀팁 순서(팀원 → 문제 → 차별성 → 구현 · 기술 → 시연)에 맞춰 구성했어요.
- 시연 영상(12장, 오른쪽에 데모 QR): 영상 파일을 `media/demo.mp4`에 두고 다시 만들면 들어가요. 없으면 영상 자리만 그려져 있어서 PowerPoint에서 그 자리에 '삽입 → 비디오'로 넣으면 돼요 (세로 휴대폰 화면 비율 390×844).
- 발표 대본(장별 시간 · 예상 질문): `발표대본.md`
- 심사 예상 질문 42개와 답변 · 이유 · 꼬리 질문: `심사예상질문.md`
- 시연 영상 녹화 방법(계정 2개 · 보낼 대화 · 순서): `demo-script.md`
- 휴대폰 목업(표지 · 11장): `shots/mock-chat.png` · `mock-proposal.png` · `mock-meeting.png`. 데모 화면을 Chrome으로 640×960(2배) 캡처한 뒤 `node mockup.js 캡처.png shots/mock-이름.png` (화면 390×844 자리를 잘라 둥근 화면 + 테두리 + 그림자).
- **HTML 발표 파일** (Pretendard가 없는 컴퓨터 · 영상 넣기용): `html/` 폴더를 통째로 가져가서 `html/index.html`을 Chrome으로 열어요. 인터넷 없이 돼요.
  - 키: → · 스페이스 · 클릭 다음, ← 이전, **F** 전체 화면, **N** 대본 보기(화면 아래), **P** 발표자 창(지금 장 · 다음 장 · 대본 · 시계, 두 화면일 때 내 화면에 띄우기), **V** 12장 영상 재생/멈춤
  - 영상: `html/media/demo.mp4`로 넣으면 12장 영상 자리에 저절로 나와요 (다시 만들 필요 없음). 지금 들어간 영상은 팀원이 찍은 3분 34초 실제 녹화를 40초로 줄인 것(`media/demo.mp4`): 소리 없음, 처음 로그인 · 팀 만들기는 2배속으로 천천히(구글 계정 고르는 화면은 뺌), 대화 · 기다림은 빨리 감고 핵심 장면(@AI 부탁 · 제안 카드 · 장소 순위 · 확정)은 보통 속도 + 잠깐 멈춤, 위쪽에 단계 자막, 중간의 '다른 사람이 먼저 변경했어요' 장면은 뺌.
  - **한 파일 버전**: `python3 build-html-onefile.py 출력.html` → 그림 · 영상까지 HTML 하나(약 11.5MB)로 묶어요. 메일 · 카톡 · USB로 보내고 더블클릭해서 Chrome으로 열면 돼요.
  - 슬라이드를 고쳤다면 다시 만들기: PowerPoint로 PDF 저장 → `swift pdfpng.swift 발표.pdf html/slides 2` (1920×1080 그림) → `python3 build-html.py`
