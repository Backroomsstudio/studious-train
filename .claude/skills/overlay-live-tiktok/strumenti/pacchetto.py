"""ZIP pronto da copiare sul PC della diretta, dai file versionati (niente node_modules, config.json, dati/).
I .cmd vengono convertiti con gli a-capo di Windows (CRLF).

  python3 pacchetto.py <cartella-overlay-nel-repo> <out.zip>      (dalla radice del repo git)
"""
import io, os, subprocess, sys, tarfile, zipfile

cartella, out = sys.argv[1].rstrip("/"), sys.argv[2]
tar = subprocess.run(["git", "archive", "HEAD", cartella], check=True, capture_output=True).stdout
with tarfile.open(fileobj=io.BytesIO(tar)) as t, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for m in t.getmembers():
        if not m.isfile():
            continue
        dati = t.extractfile(m).read()
        if m.name.lower().endswith((".cmd", ".bat")):
            dati = dati.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
        z.writestr(m.name, dati)
print(f"{out}: {os.path.getsize(out) // 1024} KB, {len(zipfile.ZipFile(out).namelist())} file")
print("Prova da zero: estrai in una cartella nuova, npm install --omit=dev, npm test, avvia il server.")
