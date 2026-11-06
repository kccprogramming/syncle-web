"""
발표 자료를 HTML 발표 파일로 만들어요 (Pretendard가 없는 컴퓨터 · 영상 넣기용).

준비: slides/01.png ~ 15.png 는 PowerPoint로 저장한 PDF를 그림으로 바꾼 것 (README 참고).
실행: python3 build-html.py   →  html/index.html
영상: html/media/demo.mp4 를 넣으면 12장 영상 자리에 저절로 나와요 (다시 만들 필요 없음).
"""
import json
import os

from pptx import Presentation

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "html")

notes = []
for s in Presentation(os.path.join(HERE, "Syncle_발표.pptx")).slides:
    notes.append(s.notes_slide.notes_text_frame.text if s.has_notes_slide else "")

slides = sorted(f for f in os.listdir(os.path.join(OUT, "slides")) if f.endswith(".png"))
assert len(slides) == len(notes), f"그림 {len(slides)}장 · 노트 {len(notes)}장 — 개수가 달라요"

imgs = "\n  ".join(
    f'<img class="slide" src="slides/{f}" alt="{i + 1}장" draggable="false">' for i, f in enumerate(slides)
)
html = open(os.path.join(HERE, "html-template.html"), encoding="utf-8").read()
html = html.replace("<!--SLIDES-->", imgs).replace("/*NOTES*/[]", json.dumps(notes, ensure_ascii=False))
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)
print("wrote", os.path.join(OUT, "index.html"), len(slides), "slides")
