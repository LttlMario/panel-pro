from pathlib import Path
import math, subprocess, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'media' / 'video-ad'
OUT = ASSETS / 'panel-pro-tiktok.mp4'
WORK = ROOT / '.video-ad-render'
W, H, FPS = 540, 960, 30

slides = [
    ('logo.png', 'PLATFORMĂ PENTRU ORGANIZAȚII', 'Panel Pro', 'Tot ce ai nevoie. Într-un singur loc.'),
    ('slide-02.png', 'COMUNICARE INSTANTĂ', 'Anunțuri pentru echipa ta.', 'Publică, întreabă și creează sondaje în câteva secunde.'),
    ('slide-03.png', 'TOTUL ORGANIZAT', 'Fiecare mesaj ajunge unde trebuie.', 'Separat pentru organizație și angajați.'),
    ('slide-04.png', 'CONTRACTE', 'Documente fără bătăi de cap.', 'Generează contracte pe baza șablonului organizației.'),
    ('slide-05.png', 'ÎNVOIRI', 'Cereri clare. Răspunsuri rapide.', 'Formulare, aprobare și istoric într-un singur loc.'),
    ('slide-07.png', 'PONTAJ INTELIGENT', 'Știi cine lucrează. Știi când.', 'Ture, pauze și rapoarte sincronizate.'),
    ('slide-08.png', 'STASH ȘI DONAȚII', 'Resursele rămân sub control.', 'Cereri, donații și aprobări cu butoane Discord.'),
    ('slide-09.png', 'STATUS LIVE', 'Vezi activitatea în timp real.', 'Date live pentru organizația ta, direct în panel.'),
    ('slide-13.png', 'FLUXURI COMPLETE', 'Mai puține mesaje. Mai mult control.', 'Totul salvat, urmărit și accesibil după rol.'),
    ('slide-15.png', 'MARKETPLACE', 'Publică și găsește resurse rapid.', 'Anunțuri, servicii și module pentru comunitatea ta.'),
    ('slide-19.png', 'DISCORD + WEB', 'Un singur sistem. Oriunde lucrezi.', 'Panoul web și botul Discord lucrează împreună.'),
    ('logo.png', 'ORGANIZEAZĂ. AUTOMATIZEAZĂ. CREȘTE.', 'Panel Pro pentru organizația ta.', 'Intră acum pe panel-pro.ro'),
]
durations = [3, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 3]

def font(size, bold=False):
    candidates = ['C:/Windows/Fonts/seguisb.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']
    return ImageFont.truetype(next(path for path in candidates if Path(path).exists()), size)

def make_frame(name, eyebrow, title, body, index):
    image = Image.open(ASSETS / name).convert('RGB')
    canvas = Image.new('RGB', (W, H), '#030711')
    draw = ImageDraw.Draw(canvas)
    for y in range(H):
        mix = y / H
        draw.line((0, y, W, y), fill=(3, int(10 + 15 * mix), int(24 + 28 * mix)))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((W * .12, H * .02, W * .95, H * .58), fill=(32, 155, 205, 55))
    glow = glow.filter(ImageFilter.GaussianBlur(55))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), glow).convert('RGB')
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((22, 22, W - 22, H - 22), radius=25, outline=(55, 92, 145), width=2)
    target_w, target_h = int(W * .86), int(H * .43)
    image.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
    x, y = (W - image.width) // 2, 75
    if name == 'logo.png':
        image.thumbnail((250, 250), Image.Resampling.LANCZOS)
        x, y = (W - image.width) // 2, 90
    frame = Image.new('RGB', (image.width + 14, image.height + 14), '#111b30')
    frame.paste(image, (7, 7))
    canvas.paste(frame, (x - 7, y - 7))
    draw = ImageDraw.Draw(canvas)
    draw.text((42, H - 350), eyebrow, font=font(15, True), fill='#63e6ef', spacing=4)
    draw.multiline_text((42, H - 310), title, font=font(38, True), fill='white', spacing=2)
    draw.multiline_text((42, H - 195), body, font=font(19), fill='#cbd5e1', spacing=5)
    draw.rounded_rectangle((42, H - 122, 42 + 205, H - 88), radius=17, fill='#655cf0')
    draw.text((58, H - 115), 'PANEL-PRO.RO', font=font(13, True), fill='white')
    return canvas

def make_audio(path, seconds):
    rate = 44100
    notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23, 440.0, 523.25, 440.0, 349.23]
    with wave.open(str(path), 'w') as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(rate)
        for i in range(int(rate * seconds)):
            note = notes[(i // (rate // 4)) % len(notes)]
            t = i / rate
            envelope = min(1, t * 20, (seconds - t) * 20)
            value = int(10500 * envelope * (math.sin(2 * math.pi * note * t) + .35 * math.sin(2 * math.pi * note * 2 * t)))
            wav.writeframes((value.to_bytes(2, 'little', signed=True)) * 2)

WORK.mkdir(exist_ok=True)
frames = []
for index, (name, eyebrow, title, body) in enumerate(slides):
    frame = WORK / f'frame-{index:02d}.png'
    make_frame(name, eyebrow, title, body, index).save(frame)
    frames.append(frame)
audio = WORK / 'music.wav'
make_audio(audio, sum(durations))
concat = WORK / 'concat.txt'
concat.write_text(''.join(f"file '{frame.as_posix()}'\nduration {duration}\n" for frame, duration in zip(frames, durations)) + f"file '{frames[-1].as_posix()}'\n", encoding='utf-8')
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ffmpeg, '-y', '-f', 'concat', '-safe', '0', '-i', str(concat), '-i', str(audio), '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', str(OUT)], check=True)
print(OUT)
