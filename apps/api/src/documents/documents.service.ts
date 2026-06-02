import { Injectable, Logger, Optional } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as ejs from 'ejs';
import { S3Service } from '../s3/s3.service';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private s3: S3Service,
    @Optional() @InjectQueue('pdf') private pdfQueue?: Queue,
  ) {}

  async generateWorkOrderPdf(
    auctionId: string,
    clientName: string,
    vendorName: string,
    vendorAddress: string,
    auctionTitle: string,
    totalWeight: number,
    winningAmount: number,
  ): Promise<string> {
    const s3Key = `work-orders/${auctionId}/WO-${Date.now()}.pdf`;

    const payload = {
      auctionId,
      clientName,
      vendorName,
      vendorAddress,
      auctionTitle,
      totalWeight,
      winningAmount,
      s3Key,
    };

    if (this.pdfQueue) {
      await this.pdfQueue.add('generateWorkOrder', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
      this.logger.log(`Queued PDF generation for Auction ${auctionId}`);
    } else {
      this.logger.warn(
        `PDF Queue not found. Running generation synchronously for Auction ${auctionId}`,
      );
      await this.executeGenerateWorkOrderPdf(payload);
    }

    // We return the expected key immediately so the caller can save the DB record.
    // The background job will fulfill the file at this key location shortly after.
    return s3Key;
  }

  async generatePoPdf(params: {
    auctionId: string;
    poNumber: string;
    clientName: string;
    clientAddress: string;
    clientGst: string;
    vendorName: string;
    vendorAddress: string;
    vendorGst: string;
    auctionTitle: string;
    category: string;
    totalWeight: number;
    winningAmount: number;
    commissionAmount: number;
    date?: string;
  }): Promise<string> {
    const { auctionId } = params;
    const html = this.buildPoHtml(params);
    return this.htmlToPdfAndUpload(
      html,
      `purchase-orders/${auctionId}`,
      `PO-${auctionId.substring(0, 8).toUpperCase()}.pdf`,
    );
  }

  async generateAgreementPdf(params: {
    auctionId: string;
    clientName: string;
    vendorName: string;
    auctionTitle: string;
    totalWeight: number;
    winningAmount: number;
    date: string;
  }): Promise<string> {
    const { auctionId } = params;
    const html = this.buildAgreementHtml(params);
    return this.htmlToPdfAndUpload(
      html,
      `agreements/${auctionId}`,
      `AGR-${auctionId.substring(0, 8).toUpperCase()}.pdf`,
    );
  }

  async generateInvoicePdf(params: {
    pickupId: string;
    invoiceNumber: string;
    auctionId: string;
    clientName: string;
    vendorName: string;
    auctionTitle: string;
    finalWeight: number;
    finalAmount: number;
    commissionAmount: number;
    date: string;
  }): Promise<string> {
    const { pickupId } = params;
    const html = this.buildInvoiceHtml(params);
    return this.htmlToPdfAndUpload(
      html,
      `invoices/${pickupId}`,
      `INV-${params.invoiceNumber}.pdf`,
    );
  }

  private async htmlToPdfAndUpload(
    html: string,
    folder: string,
    fileName: string,
  ): Promise<string> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });

      const customKey = `${folder}/${fileName}`;
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: fileName,
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        buffer: Buffer.from(pdfBuffer),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
      const { key } = await this.s3.upload(file, folder, false, customKey);
      return key;
    } finally {
      if (browser) await browser.close();
    }
  }

  private buildPoHtml(p: any): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Purchase Order ${p.poNumber}</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}
  h1{font-size:20px;color:#1E8E3E;margin:0}
  .header{display:flex;justify-content:space-between;border-bottom:2px solid #1E8E3E;padding-bottom:16px;margin-bottom:24px}
  .section{margin-bottom:18px}
  .section-title{font-size:11px;font-weight:bold;text-transform:uppercase;color:#1E8E3E;border-bottom:1px solid #d1fae5;padding-bottom:4px;margin-bottom:10px;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#f0fdf4;text-align:left;padding:7px 10px;font-size:11px;border:1px solid #d1fae5}
  td{padding:7px 10px;border:1px solid #e5e7eb}
  .row{display:flex;gap:32px}
  .col{flex:1}
  .total{font-weight:bold;color:#1E8E3E}
  .sig{margin-top:50px;display:flex;justify-content:space-between}
  .sig-box{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px;font-size:11px}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:bold;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
  footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:10px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head><body>
<div class="header">
  <div><h1>PURCHASE ORDER</h1><p style="margin:4px 0 0;color:#6b7280;font-size:12px">WeConnect E-Waste Aggregator Platform</p></div>
  <div style="text-align:right">
    <p style="margin:0;font-weight:bold;font-size:16px">${p.poNumber}</p>
    <p style="margin:4px 0;font-size:12px;color:#6b7280">Date: ${p.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
    <span class="badge">OFFICIAL DOCUMENT</span>
  </div>
</div>
<div class="row">
  <div class="col section"><div class="section-title">Buyer (Client)</div>
    <p style="margin:4px 0;font-weight:bold">${p.clientName}</p>
    <p style="margin:2px 0;color:#374151">${p.clientAddress || 'Address on file'}</p>
    ${p.clientGst ? `<p style="margin:2px 0;color:#374151">GST: ${p.clientGst}</p>` : ''}
  </div>
  <div class="col section"><div class="section-title">Seller (Vendor)</div>
    <p style="margin:4px 0;font-weight:bold">${p.vendorName}</p>
    <p style="margin:2px 0;color:#374151">${p.vendorAddress || 'Address on file'}</p>
    ${p.vendorGst ? `<p style="margin:2px 0;color:#374151">GST: ${p.vendorGst}</p>` : ''}
  </div>
</div>
<div class="section"><div class="section-title">Material Details</div>
  <table>
    <tr><th>Description</th><th>Category</th><th>Qty (kg)</th><th>Unit Price</th><th>Total Value</th></tr>
    <tr>
      <td>${p.auctionTitle}</td><td>${p.category || 'E-Waste'}</td><td>${p.totalWeight} kg</td>
      <td>₹${p.totalWeight > 0 ? (p.winningAmount / p.totalWeight).toFixed(2) : '—'}/kg</td>
      <td>₹${p.winningAmount.toLocaleString('en-IN')}</td>
    </tr>
  </table>
</div>
<div class="section"><div class="section-title">Commercial Summary</div>
  <table>
    <tr><th>Component</th><th>Amount</th></tr>
    <tr><td>Material Value (payable to Client)</td><td>₹${p.winningAmount.toLocaleString('en-IN')}</td></tr>
    <tr><td>WeConnect Platform Fee (5%)</td><td>₹${p.commissionAmount.toLocaleString('en-IN')}</td></tr>
    <tr><td class="total">Total Payable by Vendor</td><td class="total">₹${(p.winningAmount + p.commissionAmount).toLocaleString('en-IN')}</td></tr>
  </table>
</div>
<div class="section"><div class="section-title">Terms & Conditions</div>
  <ul style="padding-left:18px;line-height:1.8">
    <li>Payment to be made within 7 working days of PO issuance.</li>
    <li>Material pickup to be completed within 15 working days of PO acknowledgement.</li>
    <li>Vendor must comply with CPCB e-waste handling guidelines.</li>
    <li>Recycling/disposal certificates must be submitted within 30 days of pickup.</li>
    <li>Any shortage or excess in weight to be reconciled at actual rates.</li>
  </ul>
</div>
<div class="sig">
  <div class="sig-box">Client Signature &amp; Stamp</div>
  <div class="sig-box">Vendor Signature &amp; Stamp</div>
  <div class="sig-box">WeConnect Authority</div>
</div>
<footer>This Purchase Order is digitally generated by WeConnect E-Waste Aggregator Platform. Ref: ${p.auctionId}</footer>
</body></html>`;
  }

  private buildAgreementHtml(p: any): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Agreement - ${p.auctionId}</title>
<style>
  body{font-family:Arial,sans-serif;padding:48px;color:#111;font-size:13px;line-height:1.7}
  h1{font-size:18px;text-align:center;color:#1E4ED8;margin-bottom:4px}
  h2{font-size:13px;color:#1E4ED8;margin-top:24px;margin-bottom:6px}
  p{margin:6px 0}
  .center{text-align:center}
  .sig{margin-top:60px;display:flex;justify-content:space-between}
  .sig-box{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px;font-size:11px}
  footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:10px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head><body>
<h1>E-WASTE RECYCLING AGREEMENT</h1>
<p class="center" style="color:#6b7280;font-size:12px">WeConnect E-Waste Aggregator Platform &nbsp;|&nbsp; Date: ${p.date}</p>
<p style="margin-top:20px">This Agreement is entered into on <strong>${p.date}</strong>, between:</p>
<p><strong>Party A (Client / Generator):</strong> ${p.clientName}</p>
<p><strong>Party B (Vendor / Recycler):</strong> ${p.vendorName}</p>
<p><strong>Facilitated by:</strong> WeConnect E-Waste Aggregator Platform</p>
<h2>1. Scope of Work</h2>
<p>Party B agrees to collect, transport, and responsibly recycle/dispose of the following e-waste material from Party A's premises, as won in a competitive auction process on the WeConnect platform.</p>
<p><strong>Lot:</strong> ${p.auctionTitle} &nbsp;|&nbsp; <strong>Estimated Weight:</strong> ${p.totalWeight} kg &nbsp;|&nbsp; <strong>Agreed Value:</strong> ₹${p.winningAmount.toLocaleString('en-IN')}</p>
<h2>2. Obligations of Party B (Vendor)</h2>
<ul>
  <li>Pick up material within 15 working days of gate pass issuance.</li>
  <li>Provide all necessary documents: delivery challan, weight slips, and vehicle details at the time of pickup.</li>
  <li>Process e-waste in strict compliance with E-Waste (Management) Rules, 2022 and CPCB guidelines.</li>
  <li>Submit valid Recycling Certificate / Disposal Certificate within 30 days of pickup.</li>
  <li>Maintain chain-of-custody documentation (Form 6 / manifests) as required by law.</li>
</ul>
<h2>3. Obligations of Party A (Client)</h2>
<ul>
  <li>Issue gate pass and provide access for material pickup on the agreed date.</li>
  <li>Ensure material is as described in the auction listing.</li>
  <li>Process payment as per the agreed terms.</li>
</ul>
<h2>4. Payment Terms</h2>
<p>Party B shall pay ₹${p.winningAmount.toLocaleString('en-IN')} to Party A as material value. An additional platform fee of 5% is payable to WeConnect. All payments shall be made within 7 working days of PO issuance.</p>
<h2>5. Compliance & Liability</h2>
<p>Party B shall be solely responsible for compliance with all applicable environmental regulations. Any non-compliance shall constitute a material breach of this agreement and may result in penalties, account suspension, or legal action.</p>
<h2>6. Governing Law</h2>
<p>This Agreement shall be governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts at Bangalore.</p>
<div class="sig">
  <div class="sig-box">Party A — Client<br><small>${p.clientName}</small></div>
  <div class="sig-box">Party B — Vendor<br><small>${p.vendorName}</small></div>
  <div class="sig-box">WeConnect Authority<br><small>WeConnect Platform</small></div>
</div>
<footer>Digitally generated by WeConnect E-Waste Aggregator Platform. Auction Ref: ${p.auctionId}</footer>
</body></html>`;
  }

  private buildInvoiceHtml(p: any): string {
    const tax = Math.round(p.finalAmount * 0.18);
    const grandTotal = p.finalAmount + tax;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${p.invoiceNumber}</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}
  h1{font-size:20px;color:#7C3AED;margin:0}
  .header{display:flex;justify-content:space-between;border-bottom:2px solid #7C3AED;padding-bottom:16px;margin-bottom:24px}
  .section-title{font-size:11px;font-weight:bold;text-transform:uppercase;color:#7C3AED;border-bottom:1px solid #ede9fe;padding-bottom:4px;margin-bottom:10px;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#faf5ff;text-align:left;padding:7px 10px;font-size:11px;border:1px solid #ede9fe}
  td{padding:7px 10px;border:1px solid #e5e7eb}
  .total{font-weight:bold;color:#7C3AED}
  .sig{margin-top:50px;display:flex;justify-content:space-between}
  .sig-box{border-top:1px solid #111;width:180px;text-align:center;padding-top:6px;font-size:11px}
  footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:10px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head><body>
<div class="header">
  <div><h1>TAX INVOICE</h1><p style="margin:4px 0 0;color:#6b7280;font-size:12px">WeConnect E-Waste Aggregator Platform</p></div>
  <div style="text-align:right">
    <p style="margin:0;font-weight:bold;font-size:16px">INV-${p.invoiceNumber}</p>
    <p style="margin:4px 0;font-size:12px;color:#6b7280">Date: ${p.date}</p>
  </div>
</div>
<div style="display:flex;gap:32px;margin-bottom:18px">
  <div style="flex:1"><div class="section-title">Billed From (Client)</div><p style="font-weight:bold;margin:4px 0">${p.clientName}</p></div>
  <div style="flex:1"><div class="section-title">Billed To (Vendor)</div><p style="font-weight:bold;margin:4px 0">${p.vendorName}</p></div>
</div>
<div><div class="section-title">Items</div>
  <table>
    <tr><th>Description</th><th>Qty (kg)</th><th>Rate</th><th>Amount</th></tr>
    <tr>
      <td>${p.auctionTitle}</td>
      <td>${p.finalWeight} kg (verified)</td>
      <td>₹${p.finalWeight > 0 ? (p.finalAmount / p.finalWeight).toFixed(2) : '—'}/kg</td>
      <td>₹${p.finalAmount.toLocaleString('en-IN')}</td>
    </tr>
  </table>
  <table>
    <tr><td>Sub-Total</td><td>₹${p.finalAmount.toLocaleString('en-IN')}</td></tr>
    <tr><td>GST @ 18%</td><td>₹${tax.toLocaleString('en-IN')}</td></tr>
    <tr><td class="total">Grand Total</td><td class="total">₹${grandTotal.toLocaleString('en-IN')}</td></tr>
    <tr><td>Platform Commission (5%)</td><td>₹${p.commissionAmount.toLocaleString('en-IN')}</td></tr>
    <tr><td>Net Payable to Client</td><td>₹${p.finalAmount.toLocaleString('en-IN')}</td></tr>
  </table>
</div>
<div class="sig">
  <div class="sig-box">Authorised Signatory (Client)</div>
  <div class="sig-box">Authorised Signatory (Vendor)</div>
</div>
<footer>Tax Invoice generated by WeConnect E-Waste Aggregator Platform. Auction Ref: ${p.auctionId}</footer>
</body></html>`;
  }

  async executeGenerateWorkOrderPdf(payload: any): Promise<string> {
    const {
      auctionId,
      clientName,
      vendorName,
      vendorAddress,
      auctionTitle,
      totalWeight,
      winningAmount,
      s3Key,
    } = payload;
    this.logger.log(`Executing Work Order Generation for Auction ${auctionId}`);

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Work Order - ${auctionId}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            h1 { color: #1E8E3E; text-align: center; border-bottom: 2px solid #1E8E3E; padding-bottom: 10px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .details { width: 48%; }
            .section { margin-top: 30px; }
            .section-title { font-size: 18px; font-weight: bold; background-color: #f5f7fa; padding: 10px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f7fa; }
            .footer { margin-top: 60px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #777; text-align: center; }
            .signature-box { margin-top: 50px; display: flex; justify-content: space-between; }
            .sign-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
        </style>
    </head>
    <body>
        <h1>OFFICIAL WORK ORDER</h1>
        
        <div class="header">
            <div class="details">
                <p><strong>Date:</strong> <%= new Date().toLocaleDateString() %></p>
                <p><strong>Work Order Ref:</strong> WO-<%= String(auctionId).substring(0, 8).toUpperCase() %></p>
            </div>
            <div class="details" style="text-align: right;">
                <p><strong>Generated by:</strong> EcoLoop / We Connect</p>
            </div>
        </div>

        <div class="section">
            <div class="section-title">1. Contracting Parties</div>
            <div style="display: flex; justify-content: space-between;">
                <div class="details">
                    <p><strong>Client (Generator):</strong><br/> <%= clientName %></p>
                </div>
                <div class="details">
                    <p><strong>Vendor (Recycler):</strong><br/> <%= vendorName %><br/> <%= vendorAddress %></p>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">2. Lot Details</div>
            <table>
                <tr>
                    <th>Description</th>
                    <th>Weight (Est.)</th>
                    <th>Final Winning Amount</th>
                </tr>
                <tr>
                    <td><%= auctionTitle %></td>
                    <td><%= totalWeight %> Kg</td>
                    <td>₹ <%= winningAmount.toLocaleString('en-IN') %></td>
                </tr>
            </table>
        </div>

        <div class="section">
            <div class="section-title">3. Terms & Conditions</div>
            <ul>
                <li>The Vendor agrees to pick up the material within 7 working days.</li>
                <li>The Vendor must provide a valid Pickup Challan at the time of material handover.</li>
                <li>The Vendor is strictly bound to process the e-waste in compliance with CPCB guidelines.</li>
                <li>The Vendor must upload the final E-Waste Recycling Certificate to the EcoLoop portal to close the EPR loop.</li>
            </ul>
        </div>

        <div class="signature-box">
            <div>
                <div class="sign-line">Authorized Signatory (Client)</div>
            </div>
            <div>
                <div class="sign-line">Authorized Signatory (Vendor)</div>
            </div>
        </div>

        <div class="footer">
            This is a digitally generated Work Order created by the EcoLoop Platform upon the conclusion of a verified auction.
        </div>
    </body>
    </html>
    `;

    const compiledHtml = ejs.render(htmlContent, {
      auctionId,
      clientName,
      vendorName,
      vendorAddress: vendorAddress || 'Address on file',
      auctionTitle,
      totalWeight: totalWeight || 0,
      winningAmount,
    });

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(compiledHtml, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: `WO-${auctionId}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        buffer: Buffer.from(pdfBuffer),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const { key } = await this.s3.upload(
        file,
        `work-orders/${auctionId}`,
        false,
        s3Key,
      );

      this.logger.log(`Successfully generated and uploaded Work Order: ${key}`);
      return key;
    } catch (error) {
      this.logger.error('Failed to generate Work Order PDF', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
