"""Copia os JSON de performance do Google Drive para portal/dados/, trancados.

Lê os arquivos "FINAL - dd.mm.aaaa.json" da pasta do Drive, compacta (gzip),
criptografa com a chave mestra do portal (AES-GCM) e grava como
portal/dados/dd.mm.aaaa.json. Só regrava o que mudou no Drive.
"""
import base64, gzip, io, json, os, re, sys
from datetime import date, timedelta

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

DIAS = 62
OUT = "portal/dados"
INDEX = os.path.join(OUT, "index.json")
NOME = re.compile(r"^FINAL - (\d{2})\.(\d{2})\.(\d{4})\.json$", re.I)


def main():
    sa = json.loads(os.environ["GDRIVE_SA_JSON"])
    pasta = os.environ["GDRIVE_FOLDER_ID"].strip()
    chave = base64.b64decode(os.environ["GETLOG_MASTER_KEY"].strip())
    if len(chave) != 32:
        sys.exit("GETLOG_MASTER_KEY inválida: copie de novo pelo portal (Usuários → Chave da automação).")

    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/drive.readonly"])
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)

    arquivos, token = [], None
    while True:
        r = drive.files().list(
            q=f"'{pasta}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, md5Checksum, modifiedTime)",
            pageSize=1000, pageToken=token,
            supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        arquivos += r.get("files", [])
        token = r.get("nextPageToken")
        if not token:
            break
    if not arquivos:
        sys.exit("Nenhum arquivo visível na pasta. Ela foi compartilhada com o e-mail da conta de serviço?")

    limite = date.today() - timedelta(days=DIAS)
    os.makedirs(OUT, exist_ok=True)
    try:
        indice = json.load(open(INDEX))
    except (FileNotFoundError, ValueError):
        indice = {}

    vistos = set()
    for f in arquivos:
        m = NOME.match(f["name"])
        if not m:
            continue
        dd, mm, aaaa = m.groups()
        if date(int(aaaa), int(mm), int(dd)) < limite:
            continue
        destino = f"{dd}.{mm}.{aaaa}.json"
        vistos.add(destino)
        assinatura = f.get("md5Checksum") or f["modifiedTime"]
        if indice.get(destino) == assinatura and os.path.exists(os.path.join(OUT, destino)):
            continue

        buf = io.BytesIO()
        dl = MediaIoBaseDownload(buf, drive.files().get_media(fileId=f["id"], supportsAllDrives=True))
        feito = False
        while not feito:
            _, feito = dl.next_chunk()
        bruto = buf.getvalue()
        json.loads(bruto)  # falha aqui se o arquivo do Drive estiver corrompido

        iv = os.urandom(12)
        ct = AESGCM(chave).encrypt(iv, gzip.compress(bruto, 9, mtime=0), None)
        with open(os.path.join(OUT, destino), "w") as fh:
            json.dump({"v": 1, "z": "gzip",
                       "iv": base64.b64encode(iv).decode(),
                       "ct": base64.b64encode(ct).decode()}, fh)
        indice[destino] = assinatura
        print("atualizado:", f["name"])

    for nome in list(indice):
        if nome not in vistos:
            indice.pop(nome)
            caminho = os.path.join(OUT, nome)
            if os.path.exists(caminho):
                os.remove(caminho)
            print("removido (fora dos últimos dias):", nome)

    with open(INDEX, "w") as fh:
        json.dump(indice, fh, indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
