#!/usr/bin/env python3
"""Region visual diagnostics. Pixel similarity NEVER supersedes measured DOM/Figma assertions."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageStat, ImageDraw

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def bounds(rect, width, height):
    for k in ("x", "y", "width", "height"):
        if k not in rect or not isinstance(rect[k], (int, float)):
            raise ValueError("Invalid rectangle: missing numeric " + k)
    x, y, w, h = [float(rect[k]) for k in ("x", "y", "width", "height")]
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x+w > width or y+h > height:
        raise ValueError("Rectangle outside comparison viewport")
    return tuple(map(round, (x, y, x+w, y+h)))

def main():
    p = argparse.ArgumentParser()
    for k in ("reference", "actual", "regions", "out"):
        p.add_argument("--"+k, required=True)
    p.add_argument("--masks", default=None)
    args = p.parse_args()
    ref_bytes = Path(args.reference).read_bytes()
    act_bytes = Path(args.actual).read_bytes()
    reference = Image.open(args.reference).convert("RGB")
    actual = Image.open(args.actual).convert("RGB")
    if reference.size != actual.size:
        p.error("Figma and app screenshots need the SAME image dimensions/DPR/zoom")
    W, H = reference.size
    meta = json.loads(Path(args.regions).read_text())
    if meta.get("schemaVersion") != 1 or not isinstance(meta.get("regions"), list) or not meta["regions"]:
        p.error("Region manifest is required")
    masks = json.loads(Path(args.masks).read_text()).get("masks", []) if args.masks else []
    allowed = {"ORIGINAL_ASSET_UNAVAILABLE", "BENCHMARK_SUBSTITUTE"}
    excluded = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(excluded)
    for item in masks:
        if item.get("reason") not in allowed:
            p.error("Only known unavailable original image CONTENT may be masked")
        l,t,r,b = bounds(item, W, H)
        # Border of the image area is NOT masked; area geometry is checked independently.
        inset = min(3, max(0, int((r-l)/4)), max(0, int((b-t)/4)))
        if r-l>inset*2 and b-t>inset*2:
            draw.rectangle((l+inset,t+inset,r-inset-1,b-inset-1), fill=255)
    diff = ImageChops.difference(reference, actual)
    effect = diff.copy()
    effect.paste((0,0,0), mask=excluded)
    output = Path(args.out); output.mkdir(parents=True, exist_ok=True)
    Image.blend(reference,actual,.5).save(output/"overlay.png")
    ImageEnhance.Contrast(effect).enhance(4).save(output/"heatmap.png")
    Image.blend(actual,ImageEnhance.Contrast(effect).enhance(5),.45).save(output/"heatmap-overlay.png")
    per_region = []
    for item in meta["regions"]:
        label = str(item.get("id", "unknown"))
        box = bounds(item, W, H)
        crop = effect.crop(box)
        mask = excluded.crop(box)
        channel = ImageStat.Stat(crop).mean
        active = (ImageStat.Stat(mask).mean[0]/255)
        per_region.append({"id":label,"box":list(box),"meanAbsRGB":round(sum(channel)/3,5),
                           "maskedFraction":round(active,6),
                           "grade":"VISUAL_DIAGNOSTIC_ONLY"})
    info = {"schemaVersion":1,"status":"VISUAL_DIAGNOSTIC_ONLY","size":{"width":W,"height":H},
            "referenceSha256":sha(ref_bytes),"actualSha256":sha(act_bytes),
            "regions":per_region,"maskedRegions":len(masks),
            "warning":"Screenshots may differ from fonts, antialiasing, OS and original substituted photos. Numerical geometry and element recall remain separate."}
    (output/"visual-report.json").write_text(json.dumps(info,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":info["status"],"regions":len(per_region),"masked":len(masks)}))
if __name__ == "__main__":
    main()
