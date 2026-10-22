"""
Pós-processamento do PDF gerado pelo Chrome headless.

Adiciona rodapé com número da página, linha de assinatura e metadados do
documento (título, autor, assunto, palavras-chave).
"""

import io
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

PDF = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/documento-tecnico.pdf")

WIDTH, HEIGHT = 595.28, 841.89  # A4 em pontos
MARGIN_X = 45.35  # 16 mm
FOOTER_Y = 28.0


def build_footer(page_number: int, total: int) -> bytes:
    """Desenha o rodapé de uma página (usado como página de sobreposição)."""
    from reportlab.lib.utils import ImageReader  # noqa: F401  (opcional)
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(WIDTH, HEIGHT))

    # Linha fina acima do rodapé
    pdf.setStrokeColorRGB(0.88, 0.90, 0.93)
    pdf.setLineWidth(0.5)
    pdf.line(MARGIN_X, FOOTER_Y + 16, WIDTH - MARGIN_X, FOOTER_Y + 16)

    # Esquerda: identificação do documento
    pdf.setFont("Helvetica", 7.5)
    pdf.setFillColorRGB(0.58, 0.64, 0.70)
    pdf.drawString(MARGIN_X, FOOTER_Y + 5, "naPorta — Documento técnico · v0.1.0")

    # Direita: numeração
    pdf.drawRightString(
        WIDTH - MARGIN_X,
        FOOTER_Y + 5,
        f"{page_number} / {total}",
    )

    pdf.save()
    buffer.seek(0)
    return buffer.read()


def main() -> None:
    reader = PdfReader(str(PDF))
    total = len(reader.pages)
    writer = PdfWriter()

    for index, page in enumerate(reader.pages, start=1):
        footer = PdfReader(io.BytesIO(build_footer(index, total))).pages[0]
        page.merge_page(footer, over=True)
        writer.add_page(page)

    writer.add_metadata(
        {
            "/Title": "naPorta — Documento Técnico",
            "/Author": "naPorta API",
            "/Subject": (
                "Documento técnico da API de gestão de pedidos e do portal web naPorta: "
                "arquitetura, modelo de dados, API, segurança, testes e operação."
            ),
            "/Keywords": (
                "naPorta, NestJS, Prisma, PostgreSQL, JWT, Next.js, Docker, monorepo, API REST"
            ),
            "/Creator": "naPorta",
        }
    )

    with PDF.open("wb") as output:
        writer.write(output)

    print(f"OK: {PDF} ({total} páginas, rodapé e metadados aplicados)")


if __name__ == "__main__":
    main()
