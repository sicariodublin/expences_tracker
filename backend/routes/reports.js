const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const { resolveRange, fetchReportData, generatePdfReport, generateExcelReport } = require("../utils/reportGenerator");

router.post("/export", authMiddleware, validate(schemas.reportExport), async (req, res) => {
  try {
    const { format = "pdf", startDate, endDate } = req.body;
    const { start, end } = resolveRange(startDate, endDate);
    const reportData = await fetchReportData(start, end);

    if (format === "excel") {
      const buffer = await generateExcelReport(reportData);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=expense-report-${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.xlsx`);
      return res.send(buffer);
    }

    const buffer = await generatePdfReport(reportData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=expense-report-${start.format("YYYYMMDD")}-${end.format("YYYYMMDD")}.pdf`);
    res.send(buffer);
  } catch (err) {
    console.error("Error exporting report:", err);
    res.status(500).json({ error: "Failed to export report" });
  }
});

module.exports = router;
