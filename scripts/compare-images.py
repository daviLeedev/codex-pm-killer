#!/usr/bin/env python3
"""Visual diagnostic only; use same-sized Figma and actual images. Requires Pillow."""
import argparse, json
from pathlib import Path
def main():
    p=argparse.ArgumentParser()
    for name in ('reference','actual','out'):p.add_argument('--'+name,required=True)
    a=p.parse_args()
    from PIL import Image,ImageChops,ImageEnhance,ImageStat
    ref=Image.open(a.reference).convert('RGB')
    actual=Image.open(a.actual).convert('RGB')
    if ref.size!=actual.size:p.error(f'Mismatched image dimensions: {ref.size} vs {actual.size}')
    out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
    Image.blend(ref,actual,.5).save(out/'overlay.png')
    diff=ImageChops.difference(ref,actual)
    ImageEnhance.Contrast(diff).enhance(3).save(out/'difference.png')
    (out/'metrics.json').write_text(json.dumps({'size':{'width':ref.width,'height':ref.height},'mean_abs_channel_difference_0_to_255':[round(x,4) for x in ImageStat.Stat(diff).mean],'warning':'Font rendering and antialiasing make raw pixel metrics non-authoritative.'},indent=2)+'\n')
    print('Saved overlay.png, difference.png, metrics.json')
if __name__=='__main__':main()
