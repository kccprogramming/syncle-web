"""html/index.html + 그림 + 영상을 HTML 파일 하나로 묶어요 (메일 · USB로 보내기 좋게).
실행: python3 build-html-onefile.py [출력 경로]  →  기본 html/Syncle_발표_한파일.html"""
import base64, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
H = os.path.join(HERE, "html")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(H, "Syncle_발표_한파일.html")
html = open(os.path.join(H, "index.html"), encoding="utf-8").read()
def data(path, mime):
    return f"data:{mime};base64," + base64.b64encode(open(os.path.join(H, path), "rb").read()).decode()
# 그림은 한 번만 넣고 자바스크립트가 같은 주소를 쓰게 (발표자 창도 slides/xx.png를 찾아요)
imgs = {m: data(m, "image/png") for m in sorted(set(re.findall(r"slides/\d+\.png", html)))}
for m, d in imgs.items():
    html = html.replace(f'src="{m}"', f'src="{d}"')
table = "const SLIDE_DATA = {" + ",".join(f'"{m}":"{d}"' for m, d in imgs.items()) + "};"
html = html.replace("const NOTES =", table + "\nconst NOTES =", 1)
html = html.replace('"slides/" + pad(cur) + ".png"', 'SLIDE_DATA["slides/" + pad(cur) + ".png"]')
html = html.replace('"slides/" + pad(cur + 1) + ".png"', 'SLIDE_DATA["slides/" + pad(cur + 1) + ".png"]')
if os.path.exists(os.path.join(H, "media", "demo.mp4")):
    # 영상은 data: 주소로 바로 넣으면 Chrome이 못 여는 경우가 있어서, 열 때 Blob으로 바꿔서 넣어요
    b64 = base64.b64encode(open(os.path.join(H, "media", "demo.mp4"), "rb").read()).decode()
    html = html.replace(' src="media/demo.mp4"', "", 1)
    loader = ('<script id="vdata" type="application/octet-stream">' + b64 + '</script>\n<script>(function(){'
              'var s=atob(document.getElementById("vdata").textContent),a=new Uint8Array(s.length);'
              'for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);'
              'var v=document.getElementById("video");if(v)v.src=URL.createObjectURL(new Blob([a],{type:"video/mp4"}));})();</script>')
    html = html.replace("</body>", loader + "\n</body>", 1)
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, round(os.path.getsize(out) / 1e6, 1), "MB")
