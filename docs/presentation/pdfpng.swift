import PDFKit
import AppKit
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let scale = CGFloat(Double(a[3])!)
for i in 0..<doc.pageCount {
  let page = doc.page(at: i)!
  let r = page.bounds(for: .mediaBox)
  let w = Int(r.width*scale), h = Int(r.height*scale)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.setFillColor(NSColor.white.cgColor); ctx.fill(CGRect(x:0,y:0,width:w,height:h))
  ctx.scaleBy(x: scale, y: scale); page.draw(with: .mediaBox, to: ctx)
  NSGraphicsContext.restoreGraphicsState()
  let name = String(format: "%@/%02d.png", a[2], i+1)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: name))
}
print("pages", doc.pageCount, "size", doc.page(at:0)!.bounds(for: .mediaBox))
