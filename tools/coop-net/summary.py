"""Summarizes pair.sh output (`### label` headers and HOST/GUEST RESULT lines) as one table row per run.
Usage: python3 -I tools/coop-net/summary.py matrix.txt"""
import json
import re
import sys

rows = []
label = None
runs = {}
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.rstrip("\n")
    if line.startswith("### "):
        label = line[4:]
        runs[label] = {}
    m = re.match(r"^(HOST|GUEST) RESULT (.*)$", line)
    if m and label:
        runs[label][m.group(1)] = json.loads(m.group(2))


def link(r):
    links = r.get("links") or []
    return ",".join(f"{l.get('local')}/{l.get('remote')} {l.get('protocol')}{'/' + l['relayProtocol'] if l.get('relayProtocol') else ''}" for l in links) or "-"


def overlay(r):
    o = (r.get("overlay") or [""])[-1]
    rtt = re.search(r"RTT P\d: (\d+) ms", o)
    age = re.search(r"edad (\d+) ms", o)
    snaps = re.search(r"Instantáneas: (\d+)/s", o)
    kb = re.search(r"Salida: ([\d.]+) KB/s · Entrada: ([\d.]+) KB/s", o)
    parts = []
    if rtt: parts.append(f"game RTT {rtt.group(1)}")
    if snaps: parts.append(f"{snaps.group(1)} snap/s age {age.group(1) if age else '?'}")
    if kb: parts.append(f"out {kb.group(1)} in {kb.group(2)} KB/s")
    return "; ".join(parts) or "-"


print("| case | ok host/guest | guest join→listed ms | link (guest) | ICE RTT ms p50/p95 | in run (guest) | in run (host) | errors |")
print("|---|---|---|---|---|---|---|---|")
for label, r in runs.items():
    h, g = r.get("HOST", {}), r.get("GUEST", {})
    ev = g.get("events", {})
    join = ev["together"] - ev["joinClicked"] if "together" in ev and "joinClicked" in ev else "-"
    rtt = g.get("rttMs") or {}
    errs = "; ".join(filter(None, [h.get("error"), g.get("error")] + h.get("errors", [])[:1] + g.get("errors", [])[:1])) or "-"
    print(f"| {label} | {h.get('ok')}/{g.get('ok')} | {join} | {link(g)} | {rtt.get('p50')}/{rtt.get('p95')} | {overlay(g)} | {overlay(h)} | {errs} |")
