import PDFDocument from "pdfkit";

// Standard Code 39 narrow/wide table (9 elements per symbol, alternating
// bar/space starting with a bar). AWBs are numeric, so digits + '*' suffice.
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  "*": "nwnnwnwnn",
};

function drawCode39(doc: PDFKit.PDFDocument, value: string, x: number, y: number, height: number) {
  const narrow = 1.4;
  const wide = 3.4;
  let cursor = x;
  const encoded = `*${value}*`;
  for (const char of encoded) {
    const pattern = CODE39[char];
    if (!pattern) continue;
    for (let i = 0; i < pattern.length; i++) {
      const width = pattern[i] === "w" ? wide : narrow;
      if (i % 2 === 0) {
        doc.rect(cursor, y, width, height).fill("#000");
      }
      cursor += width;
    }
    cursor += narrow; // inter-character gap
  }
  return cursor - x;
}

export interface LabelData {
  orderNumber: string;
  awbNumber: string;
  codAmount?: number;
  to: { name: string; line1: string; line2?: string; city: string; state: string; pincode: string; phone: string };
  itemCount: number;
  reverse?: boolean;
}

const FROM_ADDRESS = "LuxeLoom Fulfilment Centre, Warehouse 7, Bhiwandi, Maharashtra — 421302";

/** 4×6in thermal-format shipping label with a scannable Code 39 AWB barcode. */
export function buildShippingLabel(data: LabelData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: [288, 432], margin: 16 }); // 4in × 6in

  doc.fontSize(16).font("Helvetica-Bold").text(data.reverse ? "LUXELOOM RETURN" : "LUXELOOM", { align: "left" });
  doc.fontSize(8).font("Helvetica").fillColor("#444").text("Blue Dart / DHL India — Surface", { align: "left" });
  doc.moveDown(0.5);
  doc.moveTo(16, doc.y).lineTo(272, doc.y).strokeColor("#000").stroke();
  doc.moveDown(0.5);

  // Barcode
  const barcodeY = doc.y;
  doc.save();
  drawCode39(doc, data.awbNumber, 24, barcodeY, 56);
  doc.restore();
  doc.fillColor("#000");
  doc.fontSize(11).font("Helvetica-Bold").text(`AWB ${data.awbNumber}`, 16, barcodeY + 62, { align: "center", width: 256 });
  doc.moveDown(0.8);

  if (data.codAmount && data.codAmount > 0) {
    doc.rect(16, doc.y, 256, 26).fill("#000");
    doc
      .fillColor("#fff")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(`COD — COLLECT ₹${data.codAmount.toLocaleString("en-IN")}`, 16, doc.y - 22, { align: "center", width: 256 });
    doc.fillColor("#000").moveDown(0.8);
  } else {
    doc.fontSize(10).font("Helvetica-Bold").text("PREPAID", { align: "center" });
    doc.moveDown(0.4);
  }

  const toBlock = data.reverse
    ? { heading: "DELIVER TO (WAREHOUSE)", body: FROM_ADDRESS }
    : {
        heading: "DELIVER TO",
        body: `${data.to.name}\n${data.to.line1}${data.to.line2 ? `\n${data.to.line2}` : ""}\n${data.to.city}, ${data.to.state} — ${data.to.pincode}\nPh: ${data.to.phone}`,
      };
  const fromBlock = data.reverse
    ? {
        heading: "PICKUP FROM (CUSTOMER)",
        body: `${data.to.name}\n${data.to.line1}${data.to.line2 ? `\n${data.to.line2}` : ""}\n${data.to.city}, ${data.to.state} — ${data.to.pincode}\nPh: ${data.to.phone}`,
      }
    : { heading: "FROM", body: FROM_ADDRESS };

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#666").text(toBlock.heading, 16, doc.y);
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text(toBlock.body, { width: 256 });
  doc.moveDown(0.6);

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#666").text(fromBlock.heading);
  doc.fontSize(8).font("Helvetica").fillColor("#000").text(fromBlock.body, { width: 256 });
  doc.moveDown(0.8);

  doc.moveTo(16, doc.y).lineTo(272, doc.y).strokeColor("#ccc").stroke();
  doc.moveDown(0.4);
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(`Order ${data.orderNumber} · ${data.itemCount} item${data.itemCount === 1 ? "" : "s"} · ${new Date().toLocaleDateString("en-IN")}`);

  doc.end();
  return doc;
}
