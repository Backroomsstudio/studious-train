"""Sovrappone l'overlay (PNG trasparente 1080x1920) a uno screenshot dell'anteprima di TikTok LIVE Studio,
alla stessa scala, per controllare che i riquadri cadano dove li vuole lo studio.

  python3 composito.py <screenshot.jpg> <overlay.png> <out.jpg> <bordo_sx> <bordo_alto> <larghezza_cornice> <altezza_cornice>

bordo_sx, bordo_alto: pixel dello screenshot dove inizia la cornice del telefono (l'anteprima di LIVE Studio).
larghezza_cornice, altezza_cornice: dimensioni della cornice in pixel dello screenshot.
Le misure si prendono guardando lo screenshot ingrandito (angoli arrotondati, bordo chiaro della cornice) o
cercando con PIL dove cambia la luminosità lungo una riga e una colonna.

L'anteprima ha la forma di un telefono (circa 9:19,5): la tela 1080x1920 la riempie in altezza e i lati
vengono tagliati al centro. Scala k = altezza_cornice / 1920; larghezza visibile = larghezza_cornice / k.
Esempio (live di ottobre 2026): cornice 720x1585 px → k = 0,8255 → visibile 872 px della tela, cioè x 104…976.
Per passare da un punto dello screenshot (px, py) alla tela:
  x_tela = taglio + (px - bordo_sx) / k   con taglio = (1080 - larghezza_cornice / k) / 2
  y_tela = (py - bordo_alto) / k
"""
import sys
from PIL import Image

foto_path, ov_path, out_path = sys.argv[1:4]
x0, y0, w_cornice, h_cornice = (float(v) for v in sys.argv[4:8])
foto = Image.open(foto_path).convert("RGBA")
ov = Image.open(ov_path).convert("RGBA")
k = h_cornice / 1920
ov = ov.resize((round(1080 * k), round(1920 * k)), Image.LANCZOS)
# la tela è centrata nella cornice: ai lati resta fuori `taglio` pixel della tela
taglio = (1080 - w_cornice / k) / 2
dx = round(x0 - taglio * k)
if dx < 0:
    ov = ov.crop((-dx, 0, ov.width, ov.height))
    dx = 0
foto.alpha_composite(ov, (dx, round(y0)))
foto.convert("RGB").save(out_path, quality=90)
print(f"k={k:.4f}  tela visibile x {taglio:.0f}…{1080 - taglio:.0f}  → {out_path}")
