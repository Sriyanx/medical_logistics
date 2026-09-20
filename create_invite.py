from PIL import Image, ImageDraw, ImageFont
import sys

filename = sys.argv[1] if len(sys.argv) > 1 else 'invoice.png'
lines = sys.argv[2:] if len(sys.argv) > 2 else ['Test Invoice']

img = Image.new('RGB', (900, 200 + len(lines) * 30), color='white')
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('/c/Windows/Fonts/arial.ttf', 18)
    header_font = ImageFont.truetype('/c/Windows/Fonts/arial.ttf', 22)
except:
    font = ImageFont.load_default()
    header_font = ImageFont.load_default()

y = 20
for i, line in enumerate(lines):
    f = header_font if i == 0 else font
    draw.text((30, y), line, fill='black', font=f)
    y += 32

img.save(filename)
print(f'Created {filename}')
