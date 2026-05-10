#!/usr/bin/env python3
"""ARCHILINK-TANITIM.md → ARCHILINK-TANITIM.pdf (Türkçe, Arial Unicode)."""
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
MD = ROOT / "ARCHILINK-TANITIM.md"
OUT = ROOT / "ARCHILINK-TANITIM.pdf"
FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def main():
    text = MD.read_text(encoding="utf-8")
    lines = text.splitlines()

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    pdf.add_font("U", "", FONT)

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            pdf.ln(3)
            continue
        if line.strip() == "---":
            pdf.ln(4)
            continue
        if line.startswith("# "):
            pdf.ln(5)
            pdf.set_x(pdf.l_margin)
            pdf.set_font("U", size=16)
            pdf.multi_cell(0, 8, line[2:].strip())
            pdf.set_font("U", size=11)
            continue
        if line.startswith("## "):
            pdf.ln(5)
            pdf.set_x(pdf.l_margin)
            pdf.set_font("U", size=13)
            pdf.multi_cell(0, 7, line[3:].strip())
            pdf.set_font("U", size=11)
            continue
        if line.startswith("### "):
            pdf.ln(3)
            pdf.set_x(pdf.l_margin)
            pdf.set_font("U", size=11.5)
            pdf.multi_cell(0, 6.5, line[4:].strip())
            pdf.set_font("U", size=11)
            continue
        pdf.set_x(pdf.l_margin)
        pdf.set_font("U", size=11)
        pdf.multi_cell(0, 6.2, line)

    pdf.output(str(OUT))
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
