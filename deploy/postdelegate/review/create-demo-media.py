"""Create original upload fixtures, not a screen recording or publishing proof.

Requires Pillow and ffmpeg. Run from any directory; outputs stay in ignored .local.
No network requests, customer data, third-party footage or music are used.
"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / '.local' / 'review-media'
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
if not FONT.exists() or not BOLD.exists():
    raise SystemExit('Set FONT/BOLD to installed, licensed TrueType fonts.')
FFMPEG = shutil.which('ffmpeg')
if not FFMPEG:
    raise SystemExit('ffmpeg is required')


def frame(width, height, progress=0):
    image = Image.new('RGB', (width, height), '#080A0F')
    draw = ImageDraw.Draw(image)
    scale = width / 720

    def text(y, value, size, color='#F7F7F2', bold=False):
        font = ImageFont.truetype(str(BOLD if bold else FONT), round(size * scale))
        draw.text((width / 2, y * height), value, fill=color, font=font, anchor='mm')

    mark = Image.open(ROOT / 'site/public/postdelegate-icon-512.png').convert('RGBA')
    side = round(130 * scale)
    mark = mark.resize((side, side), Image.Resampling.LANCZOS)
    image.paste(mark, ((width - side) // 2, round(height * .16)), mark)
    text(.34, 'PostDelegate', 55, bold=True)
    text(.425, 'PRIVATE PUBLISHING TEST', 23, '#C8FF4D', True)
    text(.515, 'Create. Schedule. Share.', 37, bold=True)
    text(.575, 'Original media for an API integration demo.', 23, '#C4C6CE')
    text(.645, 'No customer data. No third-party footage.', 21, '#C4C6CE')
    text(.685, 'Silent video. No music.', 21, '#C4C6CE')
    x0, x1, y = round(width * .16), round(width * .84), round(height * .77)
    draw.rounded_rectangle((x0, y, x1, y + round(8 * scale)), radius=4, fill='#242633')
    draw.rounded_rectangle((x0, y, x0 + max(8, round((x1 - x0) * progress)), y + round(8 * scale)), radius=4, fill='#7357FF')
    text(.86, 'postdelegate.com', 24)
    text(.905, 'Test upload asset - not a product walkthrough', 18, '#999CA8')
    return image


frame(1080, 1350, 1).save(OUT / 'postdelegate-test-image.jpg', quality=94)
video = OUT / 'postdelegate-test-video.mp4'
fps, seconds = 24, 12
command = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
           '-pixel_format', 'rgb24', '-video_size', '720x1280', '-framerate', str(fps),
           '-i', 'pipe:0', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
           '-t', str(seconds), '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
           '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', str(video)]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
try:
    for index in range(fps * seconds):
        process.stdin.write(frame(720, 1280, (index + 1) / (fps * seconds)).tobytes())
finally:
    process.stdin.close()
if process.wait() != 0:
    raise SystemExit('Video encoding failed')

manifest = {
    'purpose': 'Original test upload assets. These are not review screen recordings.',
    'suggested_visibility': 'Private / Self only (or Pinterest Trial creator-only)',
    'caption': 'PostDelegate private integration test. Original demo media used to verify account connection and publishing.',
    'title': 'PostDelegate - private publishing test',
    'rights': 'Created locally for PostDelegate; no third-party footage or music.',
    'files': [dict(name=p.name, bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
              for p in (OUT / 'postdelegate-test-image.jpg', video)],
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
