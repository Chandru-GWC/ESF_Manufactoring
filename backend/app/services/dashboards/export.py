"""Excel and PDF files of a dashboard: the whole table, plus the KPIs."""
from __future__ import annotations

import io
from datetime import date, datetime
from typing import Any, List, Sequence

from app.schemas.dashboard import DashboardResponse

PDF_MAX_ROWS = 1000  # a PDF with 16,000 rows is not useful; the Excel file always has every row
HEADER_BLUE = "1F3A5F"
ZEBRA = "EEF2F7"


def _pretty(column: str) -> str:
    return column.replace("_", " ").title()


def _cell_value(value: Any) -> Any:
    """Value for an Excel cell: keep numbers and dates typed, turn anything else into text."""
    if value is None or isinstance(value, (int, float, str, bool, datetime, date)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)


# --------------------------------------------------------------------------------------------------
# Excel
# --------------------------------------------------------------------------------------------------
def build_xlsx(dash: DashboardResponse, columns: Sequence[str], rows: Sequence[Sequence[Any]]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    from openpyxl.cell import WriteOnlyCell

    wb = Workbook(write_only=True)
    header_fill = PatternFill("solid", fgColor=HEADER_BLUE)
    white_bold = Font(bold=True, color="FFFFFF")

    def head(ws, name):
        c = WriteOnlyCell(ws, value=name)
        c.fill, c.font = header_fill, white_bold
        return c

    # Sheet 1: summary (title + KPIs)
    summary = wb.create_sheet("Summary")
    for col, width in zip("ABCD", (34, 14, 8, 50)):
        summary.column_dimensions[col].width = width
    title = WriteOnlyCell(summary, value=dash.title)
    title.font = Font(size=16, bold=True, color=HEADER_BLUE)
    meta = WriteOnlyCell(summary, value=f"Plant: {dash.plant_scope}   |   Source: {dash.source_table}   |   Generated: {dash.generated_at}")
    meta.font = Font(size=9, color="666666")
    summary.append([title])
    summary.append([dash.subtitle])
    summary.append([meta])
    summary.append([])
    summary.append([head(summary, n) for n in ["KPI", "Value", "Unit", "Note"]])
    for k in dash.kpis:
        summary.append([k.label, k.value, k.unit or "", k.caption or ""])

    # Sheet 2: the whole table (write-only mode: fast even for 16,000+ rows)
    data = wb.create_sheet("Data")
    widths = [len(_pretty(c)) + 2 for c in columns]
    for row in rows[:200]:
        for c_idx, value in enumerate(row):
            widths[c_idx] = max(widths[c_idx], min(len(_text(value)) + 2, 40))
    for i, w in enumerate(widths, start=1):
        data.column_dimensions[get_column_letter(i)].width = max(10, w)
    data.freeze_panes = "A2"
    if rows:
        data.auto_filter.ref = f"A1:{get_column_letter(len(columns))}{len(rows) + 1}"
    data.append([head(data, _pretty(c)) for c in columns])
    for row in rows:
        out = []
        for value in row:
            v = _cell_value(value)
            if isinstance(v, date):  # datetime is a date too
                cell = WriteOnlyCell(data, value=v)
                cell.number_format = "yyyy-mm-dd hh:mm" if isinstance(v, datetime) else "yyyy-mm-dd"
                out.append(cell)
            else:
                out.append(v)
        data.append(out)

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


# --------------------------------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------------------------------
def _latin1(text: str) -> str:
    return text.encode("latin-1", "replace").decode("latin-1")


def build_pdf(dash: DashboardResponse, columns: Sequence[str], rows: Sequence[Sequence[Any]]) -> bytes:
    from fpdf import FPDF

    class Report(FPDF):
        def footer(self) -> None:
            self.set_y(-10)
            self.set_font("Helvetica", size=7)
            self.set_text_color(120, 120, 120)
            self.cell(0, 5, _latin1(f"{dash.title}  |  {dash.plant_scope}  |  {dash.generated_at}"), align="L")
            self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="R")

    pdf = Report(orientation="L", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.set_margins(10, 10, 10)
    pdf.add_page()
    page_w = pdf.w - 20

    # title
    pdf.set_font("Helvetica", "B", 17)
    pdf.set_text_color(31, 58, 95)
    pdf.cell(0, 9, _latin1(dash.title), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(90, 90, 90)
    pdf.cell(0, 5, _latin1(f"{dash.subtitle}   |   Plant: {dash.plant_scope}   |   Source: {dash.source_table}   |   Generated: {dash.generated_at}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    # KPI cards in one line
    tones = {"critical": (220, 38, 38), "warning": (217, 119, 6), "good": (22, 163, 74), "neutral": (31, 58, 95)}
    n = max(1, len(dash.kpis))
    gap = 3
    card_w = (page_w - gap * (n - 1)) / n
    y0 = pdf.get_y()
    for i, k in enumerate(dash.kpis):
        x = 10 + i * (card_w + gap)
        color = tones.get(k.tone, tones["neutral"])
        pdf.set_fill_color(245, 247, 250)
        pdf.set_draw_color(213, 219, 227)
        pdf.rect(x, y0, card_w, 20, style="DF")
        pdf.set_fill_color(*color)
        pdf.rect(x, y0, 1.6, 20, style="F")
        pdf.set_xy(x + 3.5, y0 + 1.5)
        pdf.set_font("Helvetica", size=7)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(card_w - 5, 4, _latin1(k.label[:40]))
        pdf.set_xy(x + 3.5, y0 + 6.5)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(*color)
        value = f"{k.value:,}" if isinstance(k.value, int) else str(k.value)
        pdf.cell(card_w - 5, 7, _latin1(f"{value}{(' ' + k.unit) if k.unit else ''}"))
        pdf.set_xy(x + 3.5, y0 + 14)
        pdf.set_font("Helvetica", size=6.5)
        pdf.set_text_color(110, 110, 110)
        pdf.cell(card_w - 5, 4, _latin1((k.caption or "")[:48]))
    pdf.set_y(y0 + 25)

    # table
    shown = list(rows[:PDF_MAX_ROWS])
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(31, 58, 95)
    note = f"All {len(rows):,} rows" if len(rows) <= PDF_MAX_ROWS else f"First {PDF_MAX_ROWS:,} of {len(rows):,} rows (the Excel file has every row)"
    pdf.cell(0, 6, _latin1(f"{dash.table.title}  -  {note}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    pdf.set_font("Helvetica", size=6.5)
    sample = shown[:200]
    raw = []
    for ci, col in enumerate(columns):
        longest = max([len(_pretty(col))] + [len(_text(r[ci])) for r in sample if ci < len(r)])
        raw.append(min(max(longest, 5), 26))
    scale = page_w / sum(raw)
    widths = [w * scale for w in raw]

    def fit(text: str, width: float) -> str:
        text = _latin1(text)
        if pdf.get_string_width(text) <= width - 2:
            return text
        while text and pdf.get_string_width(text + "...") > width - 2:
            text = text[:-1]
        return text + "..."

    def header() -> None:
        pdf.set_fill_color(31, 58, 95)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 6.5)
        for col, w in zip(columns, widths):
            pdf.cell(w, 6, fit(_pretty(col), w), border=0, fill=True)
        pdf.ln()
        pdf.set_font("Helvetica", size=6.5)
        pdf.set_text_color(40, 40, 40)

    header()
    for i, row in enumerate(shown):
        if pdf.get_y() > pdf.h - 18:
            pdf.add_page()
            header()
        pdf.set_fill_color(238, 242, 247) if i % 2 else pdf.set_fill_color(255, 255, 255)
        for ci, w in enumerate(widths):
            pdf.cell(w, 5, fit(_text(row[ci] if ci < len(row) else ""), w), border=0, fill=True)
        pdf.ln()
    return bytes(pdf.output())
