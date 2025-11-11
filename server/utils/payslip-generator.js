const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PayslipGenerator {
  constructor() {
    this.companyName = 'BSN MANAGER ENTERPRISE';
    this.companyColor = '#1976d2'; // Blue theme
  }

  async generatePayslip(employee, payrollData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Header
        this.addHeader(doc);
        
        // Employee Info
        this.addEmployeeInfo(doc, employee, payrollData);
        
        // Earnings Section
        this.addEarningsSection(doc, payrollData);
        
        // Deductions Section
        this.addDeductionsSection(doc, payrollData);
        
        // Summary
        this.addSummary(doc, payrollData);
        
        // Footer
        this.addFooter(doc);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  addHeader(doc) {
    // Company header with color
    doc.fillColor(this.companyColor)
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(this.companyName, 50, 50);
    
    doc.fillColor('#666666')
       .fontSize(12)
       .font('Helvetica')
       .text('Employee Payslip', 50, 80);
    
    // Add line separator
    doc.moveTo(50, 100)
       .lineTo(550, 100)
       .strokeColor(this.companyColor)
       .lineWidth(2)
       .stroke();
  }

  addEmployeeInfo(doc, employee, payrollData) {
    const startY = 120;
    
    doc.fillColor('#000000')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Employee Information', 50, startY);
    
    const infoY = startY + 25;
    doc.fontSize(11)
       .font('Helvetica');
    
    // Left column
    doc.text(`Name: ${employee.full_name}`, 50, infoY);
    doc.text(`Employee ID: ${employee.id}`, 50, infoY + 15);
    doc.text(`Email: ${employee.email}`, 50, infoY + 30);
    doc.text(`Phone: ${employee.phone || 'N/A'}`, 50, infoY + 45);
    
    // Right column
    doc.text(`Pay Period: ${payrollData.period_start} to ${payrollData.period_end}`, 300, infoY);
    doc.text(`Pay Date: ${new Date().toLocaleDateString()}`, 300, infoY + 15);
    doc.text(`Branch: ${employee.branch_name || 'N/A'}`, 300, infoY + 30);
    doc.text(`Position: ${employee.role}`, 300, infoY + 45);
  }

  addEarningsSection(doc, payrollData) {
    const startY = 220;
    
    // Section header
    doc.fillColor(this.companyColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('EARNINGS', 50, startY);
    
    // Table header
    doc.fillColor('#f5f5f5')
       .rect(50, startY + 25, 500, 20)
       .fill();
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('Description', 60, startY + 30)
       .text('Amount', 450, startY + 30);
    
    let currentY = startY + 50;
    
    // Basic salary
    doc.font('Helvetica')
       .text('Basic Salary', 60, currentY)
       .text(`$${parseFloat(payrollData.gross_salary || 0).toFixed(2)}`, 450, currentY);
    currentY += 15;
    
    // Bonuses (if any)
    if (payrollData.bonuses && parseFloat(payrollData.bonuses) > 0) {
      doc.text('Bonuses', 60, currentY)
         .text(`$${parseFloat(payrollData.bonuses).toFixed(2)}`, 450, currentY);
      currentY += 15;
    }
    
    // KPI Bonus (if any)
    if (payrollData.kpi_bonus && parseFloat(payrollData.kpi_bonus) > 0) {
      doc.text('KPI Bonus', 60, currentY)
         .text(`$${parseFloat(payrollData.kpi_bonus).toFixed(2)}`, 450, currentY);
      currentY += 15;
    }
    
    // Total earnings line
    doc.moveTo(50, currentY + 5)
       .lineTo(550, currentY + 5)
       .strokeColor('#cccccc')
       .lineWidth(1)
       .stroke();
    
    const totalEarnings = parseFloat(payrollData.gross_salary || 0) + 
                         parseFloat(payrollData.bonuses || 0) + 
                         parseFloat(payrollData.kpi_bonus || 0);
    
    doc.font('Helvetica-Bold')
       .text('Total Earnings', 60, currentY + 15)
       .text(`$${totalEarnings.toFixed(2)}`, 450, currentY + 15);
    
    return currentY + 40;
  }

  addDeductionsSection(doc, payrollData) {
    const startY = 350;
    
    // Section header
    doc.fillColor(this.companyColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('DEDUCTIONS', 50, startY);
    
    // Table header
    doc.fillColor('#f5f5f5')
       .rect(50, startY + 25, 500, 20)
       .fill();
    
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('Description', 60, startY + 30)
       .text('Amount', 450, startY + 30);
    
    let currentY = startY + 50;
    
    // Standard deductions
    const deductions = parseFloat(payrollData.deductions || 0);
    
    doc.font('Helvetica')
       .text('Tax & Statutory Deductions', 60, currentY)
       .text(`$${deductions.toFixed(2)}`, 450, currentY);
    currentY += 15;
    
    // Additional deductions (if any)
    if (payrollData.additional_deductions && parseFloat(payrollData.additional_deductions) > 0) {
      doc.text('Other Deductions', 60, currentY)
         .text(`$${parseFloat(payrollData.additional_deductions).toFixed(2)}`, 450, currentY);
      currentY += 15;
    }
    
    // Total deductions line
    doc.moveTo(50, currentY + 5)
       .lineTo(550, currentY + 5)
       .strokeColor('#cccccc')
       .lineWidth(1)
       .stroke();
    
    const totalDeductions = deductions + parseFloat(payrollData.additional_deductions || 0);
    
    doc.font('Helvetica-Bold')
       .text('Total Deductions', 60, currentY + 15)
       .text(`$${totalDeductions.toFixed(2)}`, 450, currentY + 15);
    
    return currentY + 40;
  }

  addSummary(doc, payrollData) {
    const startY = 480;
    
    // Net pay box
    doc.fillColor(this.companyColor)
       .rect(50, startY, 500, 60)
       .fill();
    
    doc.fillColor('#ffffff')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('NET PAY', 60, startY + 15);
    
    doc.fontSize(24)
       .text(`$${parseFloat(payrollData.net_salary || 0).toFixed(2)}`, 350, startY + 15);
    
    // Payment method
    doc.fillColor('#000000')
       .fontSize(10)
       .font('Helvetica')
       .text(`Payment Method: ${payrollData.payment_method || 'Bank Transfer'}`, 60, startY + 70);
  }

  addFooter(doc) {
    const footerY = 700;
    
    doc.fillColor('#666666')
       .fontSize(9)
       .font('Helvetica')
       .text('This is a computer-generated payslip. No signature required.', 50, footerY);
    
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, footerY + 15);
    
    doc.text('For queries, contact HR department.', 50, footerY + 30);
    
    // Company footer
    doc.fillColor(this.companyColor)
       .text(this.companyName, 400, footerY + 30);
  }
}

module.exports = new PayslipGenerator();