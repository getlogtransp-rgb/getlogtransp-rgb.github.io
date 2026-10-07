"""Modelo do report de coleta GETLOG: gera report.png + texto pro WhatsApp.
Dados ao vivo da mesma API do portal (getlogbr.com.br/portal/#performance), mesmas regras de cálculo.
Uso: python report_coleta.py [dd.mm.aaaa]"""
import json, math, re, textwrap, time, unicodedata, urllib.request
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

import matplotlib.pyplot as plt
from PIL import Image, ImageChops
from matplotlib.patches import FancyBboxPatch, Wedge

API = "https://script.google.com/macros/s/AKfycbzBrdB2u8IlJJ0o9OclHWPcpA3JUi8n5D_ebIkZ6Kzagwt01zmvsaHU50PrA2C9MzCwdA/exec"
META, ALERTA = 99.0, 80.0  # <80 vermelho, 80–99 amarelo, >=99 verde
TOP_MOT = 15  # fechamento lista no máximo 15 motoristas com mais pacotes não descarregados (texto sempre curto)
JUSTIFICADOS = {"LOJA FECHADA", "FECHADA", "PRODUTO INDISPONIVEL", "CODIGO DE COLETA NAO INFORMADO",
                "ENDERECO DIVERGENTE", "NAO LOCALIZEI O ENDERECO", "ERRO DO SISTEMA", "PACOTE CANCELADO",
                "KWAI - ERRO NA OCORRENCIA", "DROP RECEBEU", "DROP CANCELADO OU FORA DA DS FM NOR",
                "PACOTE CANCELADO OU FORA DA DS FM NOR"}
LOGO = Path(__file__).with_name("logo_getlog.webp")
PASTA = Path(r"H:\Meu Drive\PERFOMANCE\7.0 - REPORTE OPERACIONAL")
SEM_MOTORISTA = "NÃO ATRIBUÍDO NA GERAL"


def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode()
    return " ".join(s.upper().split())


_web = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())  # o Google às vezes redireciona exigindo cookie


def api(q, tentativas=3):
    for t in range(tentativas):
        try:
            with _web.open(f"{API}?{q}&force=1", timeout=120) as r:  # force=1: ignora o cache da API, igual ao botão Atualizar
                j = json.load(r)
            break
        except Exception:
            if t == tentativas - 1:
                raise
            time.sleep(10)
    if not j.get("ok"):
        raise RuntimeError(j.get("erro"))
    return j["dados"]


def buscar_dados(dia=None):
    """Baixa o dia (dd.mm.aaaa; padrão = o mais recente publicado) e calcula os KPIs como o portal."""
    dia = dia or api("fonte=lista")[0]["dia"]
    c = api("fonte=performance&dia=" + dia)["conteudo"]
    d = calcular(c["linhas"], c["data"], c["atualizado_em"][11:16])
    try:  # base de coletados (fonte oficial do coletado GETLOG no portal); sem ela, fica a conta pela performance
        cb = api("fonte=coletados&dia=" + dia)["linhas"]
        tot, desc = sum(float(a[5] or 0) for a in cb), sum(float(a[6] or 0) for a in cb)
        d.update(getlog=int(tot), nao_descarregado=int(tot - desc), coletado_total=int(tot) + d["terceiros"])
    except Exception:
        pass
    return d


def empresa(mo):
    """Empresa do motorista ("GET - Fulano" -> GET). HUB Nuvem Envio conta como GETLOG (regra do portal)."""
    e = mo.split(" - ")[0].strip() if " - " in mo else mo.strip()
    if not e:
        return "SEM MOTORISTA"
    return "GET" if norm(e) == "HUB NUVEM ENVIO" else e


def _motivos_obs(g):
    """Motivos da coluna JUSTIFICATIVA ("Produto Indisponível (49) / Em rota (703)") -> [(motivo, qtd)], sem "Em rota"/"Aceita"."""
    out = []
    for r in g:
        for parte in r["jtxt"].split(" / "):
            m = re.match(r"^(.*?)\s*\((\d+)\)$", parte.strip())
            k, q = (m.group(1), int(m.group(2))) if m else (parte.strip(), 0)
            if k and norm(k) not in ("EM ROTA", "ACEITA"):
                out.append((k, q))
    return out


st_just = lambda s: norm(s) in JUSTIFICADOS or norm(s).startswith("MISS SCAN")
motivo_pacote = lambda s: norm(s).startswith("MISS SCAN") or "CANCELADO" in norm(s)  # só do pacote, não prova visita


def motivo_visita(g):
    """Motivo de visita (Produto Indisponível, Loja Fechada, KWAI...) em qualquer pacote do seller (regra do portal)."""
    for r in g:
        if st_just(r["st"]) and not motivo_pacote(r["st"]):
            return r["st"]
    cand = [(k, q) for k, q in _motivos_obs(g) if q > 0 and st_just(k) and not motivo_pacote(k)]
    return max(cand, key=lambda x: x[1])[0] if cand else ""


def calcular(linhas, data, hora):
    num = lambda v: float(v or 0)
    rows = []
    for r in linhas:
        if not (r.get("SELLER") or r.get("SELLER ID")):
            continue
        st = r.get("STATUS DO SELLER") or ""
        pen, jus = num(r["NÃO JUSTIFICADO"]), num(r["JUSTIFICADO"])
        if norm(st) == "BAIXA INDEVIDA":  # baixa indevida conta como pendente, igual ao portal
            pen, jus = pen + jus, 0
        tot, mo = num(r["COLETADO TOTAL"]), (r.get("MOTORISTA OFICIAL") or "").strip()
        seller = r.get("SELLER") or r.get("SELLER ID")
        rows.append(dict(key=f"{norm(seller)}|{r.get('CLIENTE') or 'SEM CLIENTE'}", seller=seller,  # chave do portal: nome + cliente
                         st=st, ma=r.get("MOTORISTA ATRIBUÍDO") or SEM_MOTORISTA,
                         mo=mo, reg=r.get("REGIÃO") or "Sem região", cli=r.get("CLIENTE") or "",
                         col=num(r["COLETADO DO PREVISTO"]), prev=num(r["COLETADO DO PREVISTO"]) + num(r["NÃO COLETADO"]),
                         adi=num(r["COLETA ADIANTADA"]), tot=tot, nor=num(r.get("COLETADO DS FM NOR")), ndes=num(r["COLETADO NÃO DESCARREGADO"]), jus=jus, pen=pen, jtxt=str(r.get("JUSTIFICATIVA") or ""),
                         emp="DROP" if norm(st) == "DROP RECEBEU" and tot else empresa(mo)))
    t = {k: sum(r[k] for r in rows) for k in ("prev", "col", "adi", "tot", "ndes", "jus")}

    # estado por seller (mesma regra do sellerState do portal)
    grupos = defaultdict(list)
    for r in rows:
        grupos[r["key"]].append(r)
    status = defaultdict(lambda: [0, 0])  # status -> [sellers, previsto]
    pendentes, em_rota, sellers_prev, nao_visit, lista_pend = [], 0, 0, 0, []
    for g in grupos.values():
        prev = sum(r["prev"] for r in g)
        pen_bruto = sum(r["pen"] for r in g)
        coletou = any(r["col"] > 0 or r["tot"] > 0 for r in g)
        jus_qtd = any(r["jus"] > 0 and norm(r["st"]) != "BAIXA INDEVIDA" for r in g)  # justificado pela quantidade
        # motivo de visita em qualquer pacote justifica o seller inteiro; cancelado/miss scan só se não sobrar em rota
        mv = motivo_visita(g)
        justif = bool(mv) or (pen_bruto <= 0 and (any(st_just(r["st"]) for r in g) or jus_qtd))
        bx = [r for r in g if norm(r["st"]) == "BAIXA INDEVIDA"]
        if bx and not coletou and not jus_qtd:  # baixa indevida só pendura se ninguém coletou/justificou
            pen = sum(max(r["pen"], r["prev"] - r["col"], 0) for r in bx) or max(pen_bruto, 1)
            st = bx[0]["st"]
        else:
            visit = coletou or justif
            pen = 0 if visit else pen_bruto
            if coletou:
                st = next((r["st"] for r in g if norm(r["st"]) == "DROP RECEBEU"), "Coletado")
            elif justif:
                obs = max(_motivos_obs(g), key=lambda x: x[1], default=("", 0))[0]
                st = mv or next((r["st"] for r in g if st_just(r["st"])), "") or obs or "Justificado"
            elif pen > 0:
                st = "Em rota"
            else:
                st = "Sem pendência"
        if prev > 0:  # visita é por seller previsto (igual ao portal)
            sellers_prev += 1
            nao_visit += pen > 0
            status[st][0] += 1
            status[st][1] += prev
        if pen > 0:
            pendentes.append(g)
            lista_pend.append((g[0]["seller"], g[0]["cli"], g[0]["ma"], g[0]["reg"], int(pen), st))
            em_rota += pen

    p_rows = [r for g in pendentes for r in g if r["pen"] > 0]
    gap = defaultdict(lambda: defaultdict(float))  # (motorista, região, cliente) -> seller -> em rota
    for r in p_rows:
        gap[(r["ma"], r["reg"], r["cli"])][r["seller"]] += r["pen"]
    nome = lambda m: m.split(" - ", 1)[1] if " - " in m else m
    nd_mot = defaultdict(float)
    for r in rows:
        if r["ndes"] > 0 and r["emp"] == "GET":
            nd_mot[r["mo"] or r["ma"]] += r["ndes"]
    terceiros = sum(r["tot"] for r in rows if r["tot"] > 0 and r["emp"] != "GET")
    return {
        "data": data, "hora": hora,
        "previsto": int(t["prev"]), "sellers": sellers_prev,
        "visita_pct": pct(sellers_prev - nao_visit, sellers_prev),  # visita é por seller
        "visitados": sellers_prev - nao_visit,
        "coletado_previsto": int(t["col"]), "coletado_total": int(t["tot"]),
        "getlog": int(sum(r["nor"] for r in rows)), "terceiros": int(terceiros),  # GETLOG = soma de COLETADO DS FM NOR (regra do portal)
        "adiantado": int(t["adi"]),
        "em_rota": int(em_rota), "em_rota_sellers": len(pendentes),
        "em_rota_motoristas": len({r["ma"] for r in p_rows if r["ma"] != SEM_MOTORISTA}),
        "motoristas": len({r["mo"] for r in rows if r["tot"] > 0 and r["mo"]}),
        "nao_descarregado": int(sum(r["ndes"] for r in rows if r["emp"] == "GET")),  # só o coletado pela GETLOG
        "status": sorted(((k, v[0], int(v[1])) for k, v in status.items()), key=lambda x: -x[2]),
        "nao_desc_mot": sorted(((nome(m), int(q)) for m, q in nd_mot.items()), key=lambda x: -x[1]),
        "pendentes": sorted(((sel, cli, nome(m), reg, q, st) for sel, cli, m, reg, q, st in lista_pend), key=lambda x: (x[2], -x[4])),
        "gap": [(nome(m), f"{reg} · {cli}", int(sum(sl.values())),
                 [(sel, int(q)) for sel, q in sorted(sl.items(), key=lambda x: -x[1])])
                for (m, reg, cli), sl in sorted(gap.items(), key=lambda x: -sum(x[1].values()))[:4]],
    }


AZUL, LARANJA, VERDE, AMARELO, VERM, CINZA = "#0b1f4d", "#ea580c", "#15803d", "#ca8a04", "#b91c1c", "#64748b"
TINTA, LINHA, FUNDO = "#0f172a", "#e2e8f0", "#f4f6fa"
plt.rcParams["font.family"] = ["Segoe UI", "DejaVu Sans"]  # Segoe UI no Windows; DejaVu se rodar fora dele
n = lambda v: f"{v:,}".replace(",", ".")
pct = lambda a, b: a / b * 100 if b else 0
p = lambda a, b: f"{pct(a, b):.1f}%".replace(".", ",")
cor_perf = lambda v: VERDE if v >= META else AMARELO if v >= ALERTA else VERM


def caixa(ax, x, y, w, h, fc="white", ec=LINHA):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.008", fc=fc, ec=ec, lw=1))


def card(ax, x, y, w, h, titulo, valor, sub, cor=TINTA, destaque=None):
    caixa(ax, x, y, w, h)
    if destaque:  # filete colorido à esquerda
        ax.add_patch(FancyBboxPatch((x, y + .012), .0035, h - .024, boxstyle="square,pad=0", fc=destaque, lw=0))
    ax.text(x + .013, y + h - .03, titulo.upper(), fontsize=10, color=CINZA, weight="semibold")
    ax.text(x + .013, y + h / 2 - .02, valor, fontsize=28, weight="bold", color=cor)
    ax.text(x + .013, y + .02, sub, fontsize=11, color=CINZA)


def gerar_png(d, arquivo="report.png"):
    visita = d["visita_pct"]
    fig = plt.figure(figsize=(16, 10.5), dpi=120, facecolor=FUNDO)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")

    # cabeçalho
    ax.add_patch(FancyBboxPatch((0, .935), 1, .065, boxstyle="square,pad=0", fc=AZUL, lw=0))
    ax.add_patch(FancyBboxPatch((0, .931), 1, .004, boxstyle="square,pad=0", fc=LARANJA, lw=0))
    tx = .015
    if LOGO.exists():  # logo num selo branco à esquerda do título
        img = Image.open(LOGO).convert("RGB")
        fundo = ImageChops.difference(img, Image.new("RGB", img.size, "white")).convert("L")
        img = img.crop(fundo.point(lambda v: 255 if v > 40 else 0).getbbox())  # corta a margem branca
        ax.add_patch(FancyBboxPatch((.008, .941), .09, .052, boxstyle="round,pad=0,rounding_size=0.008", fc="white", lw=0))
        lg = fig.add_axes([.012, .945, .082, .044]); lg.imshow(img); lg.axis("off")
        tx = .108
    ax.text(tx, .975, "GETLOG TRANSPORTES", fontsize=10.5, color="#93c5fd", va="center", weight="semibold")
    ax.text(tx, .952, "Performance de Coleta", fontsize=21, weight="bold", color="white", va="center")
    ax.text(.985, .975, "ATUALIZADO", fontsize=10, color="#93c5fd", va="center", ha="right", weight="semibold")
    ax.text(.985, .952, f"{d['data']}  ·  {d['hora']}", fontsize=17, color="white", va="center", ha="right", weight="semibold")

    # painel de performance de visita
    caixa(ax, .012, .545, .27, .372, fc=AZUL, ec=AZUL)
    ax.text(.025, .89, "PERFORMANCE DE VISITA", fontsize=11, color="#93c5fd", weight="semibold")
    g = fig.add_axes([.03, .69, .235, .19]); g.set_aspect("equal"); g.axis("off"); g.set_xlim(-1.6, 1.6); g.set_ylim(-.45, 1.15)
    for ini, fim, c in ((0, ALERTA, VERM), (ALERTA, META, AMARELO), (META, 100, VERDE)):  # régua das faixas
        g.add_patch(Wedge((0, 0), 1.1, 180 - 1.8 * fim, 180 - 1.8 * ini, width=.06, fc=c))
    g.add_patch(Wedge((0, 0), .98, 0, 180, width=.26, fc="#1e3a8a"))
    g.add_patch(Wedge((0, 0), .98, 180 - 1.8 * min(visita, 100), 180, width=.26, fc=cor_perf(visita)))
    a = math.radians(180 - 1.8 * META)
    g.plot([.65 * math.cos(a), 1.15 * math.cos(a)], [.65 * math.sin(a), 1.15 * math.sin(a)], color="white", lw=2.5)
    g.text(0, -.38, f"{visita:.2f}%".replace(".", ","), fontsize=34, weight="bold", color="white", ha="center")
    falta = META - visita
    ax.add_patch(FancyBboxPatch((.07, .647), .155, .03, boxstyle="round,pad=0,rounding_size=0.012", fc=cor_perf(visita), lw=0))
    ax.text(.1475, .662, "META BATIDA" if falta <= 0 else f"FALTAM {falta:.2f} P.P. · META {META:.0f}%".replace(".", ",", 1),
            fontsize=10.5, color="white", ha="center", va="center", weight="bold")
    mini = [("Perf. coleta", pct(d["coletado_previsto"], d["previsto"]), "do previsto", True),
            ("Perf. descarga", pct(d["getlog"] - d["nao_descarregado"], d["getlog"]), "do coletado GETLOG", True),
            ("GETLOG", pct(d["getlog"], d["coletado_total"]), "do coletado", False)]
    for i, (tit, v, sub, colorir) in enumerate(mini):
        x = .02 + i * .0865
        caixa(ax, x, .555, .082, .08, fc="#13296b", ec="#13296b")
        ax.text(x + .008, .615, tit.upper(), fontsize=8.5, color="#93c5fd", weight="semibold")
        ax.text(x + .008, .58, f"{v:.1f}%".replace(".", ","), fontsize=17, weight="bold",
                color={VERDE: "#4ade80", AMARELO: "#facc15", VERM: "#f87171"}[cor_perf(v)] if colorir else "white")
        ax.text(x + .008, .562, sub, fontsize=8.5, color="#94a3b8")

    # cards KPI
    w, h, x0 = .1366, .178, .292
    linha1 = [
        ("Previsto", n(d["previsto"]), "pacotes do dia", TINTA, AZUL),
        ("Coletado do previsto", n(d["coletado_previsto"]), f"{p(d['coletado_previsto'], d['previsto'])} do previsto", TINTA, None),
        ("Em rota", n(d["em_rota"]), f"{d['em_rota_sellers']} sellers · {d['em_rota_motoristas']} motoristas", LARANJA, LARANJA),
        ("Coleta adiantada", n(d["adiantado"]), "além do previsto", TINTA, None),
        ("Motoristas", n(d["motoristas"]), "coletaram hoje", TINTA, None),
    ]
    linha2 = [
        ("Coletado total", n(d["coletado_total"]), "GETLOG + terceiros", VERDE, VERDE),
        ("Coletado GETLOG", n(d["getlog"]), f"{p(d['getlog'], d['coletado_total'])} do total", AZUL, AZUL),
        ("Coletado terceiros", n(d["terceiros"]), f"{p(d['terceiros'], d['coletado_total'])} do total", TINTA, None),
        ("Descarregado", n(d["getlog"] - d["nao_descarregado"]), f"{p(d['getlog'] - d['nao_descarregado'], d['getlog'])} do coletado GETLOG", TINTA, None),
        ("Não descarregado", n(d["nao_descarregado"]), f"{p(d['nao_descarregado'], d['getlog'])} · ainda com motorista", VERM, VERM),
    ]
    for i, c in enumerate(linha1): card(ax, x0 + i * (w + .0025), .739, w, h, *c)
    for i, c in enumerate(linha2): card(ax, x0 + i * (w + .0025), .545, w, h, *c)

    # faixa de sellers: previstos x visitados x não visitados
    nv = d["sellers"] - d["visitados"]
    caixa(ax, .012, .44, .976, .09)
    ax.text(.025, .505, "SELLERS", fontsize=10, color=CINZA, weight="semibold")
    for x, rot, val, cor in ((.025, "previstos", d["sellers"], TINTA), (.13, "visitados", d["visitados"], VERDE),
                             (.235, "não visitados", nv, VERM)):
        ax.text(x, .462, n(val), fontsize=24, weight="bold", color=cor)
        ax.text(x + .008 + .0105 * len(n(val)), .465, rot, fontsize=11.5, color=CINZA)
    bx0, bw, by = .36, .615, .47
    fr = d["visitados"] / d["sellers"] if d["sellers"] else 0
    ax.add_patch(FancyBboxPatch((bx0, by), bw, .03, boxstyle="round,pad=0,rounding_size=0.006", fc="#fee2e2", lw=0))
    ax.add_patch(FancyBboxPatch((bx0, by), bw * fr, .03, boxstyle="round,pad=0,rounding_size=0.006", fc=VERDE, lw=0))
    ax.text(bx0 + .01, by + .015, f"{p(d['visitados'], d['sellers'])} visitados", fontsize=11, color="white", va="center", weight="bold")
    ax.text(bx0 + bw - .006, by + .045, f"{n(nv)} sellers ainda sem visita", fontsize=10.5, color=VERM, ha="right", weight="semibold")

    # status da coleta
    caixa(ax, .012, .015, .47, .41)
    ax.text(.025, .395, "Status da coleta", fontsize=15, weight="bold", color=TINTA)
    ax.text(.025, .372, "pacotes previstos e sellers por status", fontsize=10.5, color=CINZA)
    bx = fig.add_axes([.175, .03, .225, .33])
    st = d["status"][::-1]
    cores = [VERDE if s[0] in ("Coletado", "DROP Recebeu") else LARANJA if s[0] == "Em rota" else VERM for s in st]
    bars = bx.barh(range(len(st)), [s[2] for s in st], color=cores, height=.62)
    bx.set_yticks(range(len(st)), [textwrap.fill(s[0], 24) for s in st], fontsize=10.5, color="#334155")
    for b, s in zip(bars, st):
        bx.text(b.get_width(), b.get_y() + b.get_height() / 2, f"  {n(s[2])}", va="center", fontsize=10.5, color=TINTA, weight="bold")
        bx.text(b.get_width(), b.get_y() + b.get_height() / 2, f"  {' ' * (len(n(s[2])) * 2 + 1)}· {n(s[1])} sellers",
                va="center", fontsize=10, color=CINZA)
    bx.spines[["top", "right", "bottom"]].set_visible(False); bx.spines["left"].set_color(LINHA)
    bx.set_xticks([]); bx.tick_params(axis="y", length=0)
    bx.set_xlim(0, max(s[2] for s in st) * 1.6); bx.set_facecolor("white")

    # onde está o gap: motorista + sellers pendentes
    caixa(ax, .492, .015, .496, .41)
    ax.text(.505, .395, "Onde está o gap", fontsize=15, weight="bold", color=TINTA)
    ax.text(.505, .372, "motoristas com mais pacotes em rota e seus sellers pendentes", fontsize=10.5, color=CINZA)
    for i, (mot, reg, qt, sellers) in enumerate(d["gap"]):
        y = .275 - i * .086
        caixa(ax, .503, y, .474, .079, fc="#fffaf5", ec="#fed7aa")
        ax.add_patch(FancyBboxPatch((.503, y + .01), .003, .059, boxstyle="square,pad=0", fc=LARANJA, lw=0))
        ax.text(.514, y + .055, f"{i + 1}. {mot}", fontsize=12, weight="bold", color=TINTA)
        ax.text(.514, y + .033, reg, fontsize=10, color=CINZA)
        lista = " · ".join(f"{s[:26]} ({n(q)})" for s, q in sellers[:3]) + (f"  +{len(sellers) - 3}" if len(sellers) > 3 else "")
        ax.text(.514, y + .01, lista, fontsize=9.5, color="#334155")
        ax.text(.97, y + .05, n(qt), fontsize=18, weight="bold", color=LARANJA, ha="right")
        ax.text(.97, y + .028, f"{p(qt, d['em_rota'])} do em rota", fontsize=10, color=CINZA, ha="right")

    fig.savefig(arquivo, facecolor=fig.get_facecolor()); plt.close(fig)
    return arquivo


def gerar_texto(d):
    visita = d["visita_pct"]
    sinal = "🟢" if visita >= META else "🟡" if visita >= ALERTA else "🔴"
    indisp = next((s for s in d["status"] if s[0] == "Produto Indisponível"), None)
    linhas = [
        f"📊 Atualização das Coletas — {d['data']} às {d['hora']}",
        f"📈 Visit Rate: {visita:.2f}% {sinal} (meta {META:.0f}%)".replace(".", ","),
        f"📦 Previsto: {n(d['previsto'])} pacotes · {n(d['sellers'])} sellers",
        f"✅ Coletado do previsto: {n(d['coletado_previsto'])} ({p(d['coletado_previsto'], d['previsto'])})",
        f"➕ Coletado total: {n(d['coletado_total'])} (adiantado {n(d['adiantado'])})",
        f"🚛 GETLOG: {n(d['getlog'])} ({p(d['getlog'], d['coletado_total'])}) | Terceiros: {n(d['terceiros'])} ({p(d['terceiros'], d['coletado_total'])})",
        f"🚚 Em rota: {n(d['em_rota'])} pacotes · {d['em_rota_sellers']} sellers · {d['em_rota_motoristas']} motoristas",
        f"👥 Sellers: {n(d['sellers'])} previstos · {n(d['visitados'])} visitados · {n(d['sellers'] - d['visitados'])} não visitados",
    ]
    if indisp:
        linhas.append(f"⚠️ Produto indisponível: {n(indisp[1])} sellers · {n(indisp[2])} pacotes")
    linhas += ["Report hora/hora", "🔗 https://getlogbr.com.br/portal/#performance"]
    return "\n\n".join(linhas)  # linha em branco entre cada item


def gerar_fechamento(d):
    """Texto do fechamento (23h50): resumo direto + motoristas que não descarregaram."""
    visita = d["visita_pct"]
    sinal = "🟢" if visita >= META else "🟡" if visita >= ALERTA else "🔴"
    nd = d["nao_desc_mot"]
    blocos = [
        f"📊 Fechamento das Coletas — {d['data']}",
        f"📈 Visit Rate: {visita:.2f}% {sinal} (meta {META:.0f}%)".replace(".", ","),
        f"👥 Sellers: {n(d['sellers'])} previstos · {n(d['visitados'])} visitados · {n(d['sellers'] - d['visitados'])} não visitados",
        f"📦 Previsto: {n(d['previsto'])} pacotes · {n(d['sellers'])} sellers",
        f"✅ Coletado do previsto: {n(d['coletado_previsto'])} ({p(d['coletado_previsto'], d['previsto'])})",
        f"➕ Coletado total: {n(d['coletado_total'])} (adiantado {n(d['adiantado'])})",
        f"🚛 Coletado GETLOG: {n(d['getlog'])} ({p(d['getlog'], d['coletado_total'])}) | Terceiros: {n(d['terceiros'])} ({p(d['terceiros'], d['coletado_total'])})",
        f"🚚 Em rota: {n(d['em_rota'])} pacotes · {d['em_rota_sellers']} sellers · {d['em_rota_motoristas']} motoristas",
        "\n".join([f"🔴 *NÃO DESCARREGADO: {n(d['nao_descarregado'])} pacotes* ({p(d['nao_descarregado'], d['getlog'])} do coletado GETLOG)",
                   f"*{len(nd)} motoristas* ainda não descarregaram:" if nd else "✅ Todos os motoristas descarregaram!"]
                  + [f"   {i}. *{m}* | {n(q)} pct" for i, (m, q) in enumerate(nd[:TOP_MOT], 1)]
                  + ([f"   ➕ outros {len(nd) - TOP_MOT} motoristas | {n(sum(q for _, q in nd[TOP_MOT:]))} pct (lista completa no painel)"]
                     if len(nd) > TOP_MOT else [])),
        "🔗 https://getlogbr.com.br/portal/#performance",
    ]
    return "\n\n".join(blocos)


def salvar(d, pasta=PASTA):
    """Salva report_HHhMM.png/.txt na pasta. Na primeira execução do dia apaga os reports dos dias anteriores."""
    pasta.mkdir(parents=True, exist_ok=True)
    for f in [*pasta.glob("report_*.png"), *pasta.glob("report_*.txt")]:
        if date.fromtimestamp(f.stat().st_mtime) != date.today():
            f.unlink()
    base = pasta / f"report_{d['hora'].replace(':', 'h')}"
    gerar_png(d, str(base) + ".png")
    Path(str(base) + ".txt").write_text(gerar_texto(d), encoding="utf-8")
    return base


def ultimo_report(pasta=PASTA):
    """O report mais recente salvo (png, texto) — é o que o disparo do WhatsApp vai usar."""
    png = max(pasta.glob("report_*.png"), key=lambda f: f.stat().st_mtime)
    return png, png.with_suffix(".txt").read_text(encoding="utf-8")


if __name__ == "__main__":
    import sys
    d = buscar_dados(sys.argv[1] if len(sys.argv) > 1 else None)
    print("salvo em", salvar(d)); print(gerar_texto(d))
