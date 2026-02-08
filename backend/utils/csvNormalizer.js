const dayjs = require("dayjs");

const parseNumber = (value) => {
  if (value === null) return 0;
  const s = String(value).replace(/\s+/g, "").replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const toIsoDate = (ddmmyyyy) => {
  if (!ddmmyyyy) return null;
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};

const buildDescription = (row, keys) => {
  const parts = keys
    .map((k) => (row[k] || "").trim())
    .filter((s) => s && s.length);
  return parts.join(" - ");
};

// Clean bank statement names similar to Excel find/replace and PROPER()
const toTitleCase = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());

const cleanName = (raw) => {
  if (!raw) return "";
  let s = String(raw);
  // Remove known prefixes and noise
  s = s.replace(/^\s*(VDC-|VDP-|D\/D|VDC-WWW)\s*/i, "");
  s = s.replace(/\*/g, "");
  // Collapse multiple spaces and dashes
  s = s.replace(/[\s-]{2,}/g, " ").trim();
  // Title case
  s = toTitleCase(s);
  return s;
};

const deriveCategory = (name) => {
  if (!name) return "Uncategorized";
  const n = name.toUpperCase();
  if (/NETFLIX|SPOTIFY/i.test(n)) return "Entertainment";
  if (/LIDL|ALDI|TESCO|SUPERVALU|SPAR|MORE 4|POLSKI/i.test(n)) return "Groceries";
  if (/APPLEGREEN|PETROL|PARKING|ONLINE MOTOR|TOLL/i.test(n)) return "Carro";
  if (/AIB CARD PYMT|NAPS LOAN|PREMIUM CREDIT/i.test(n)) return "Loan/CreditCard";
  if (/IRISH LIFE|BRECAN PHARM|GP|THE MEDICAL CENTER/i.test(n)) return "Healthcare";
  if (/BORD GAIS|EIR|RENT|GAS|MORIATY REAL/i.test(n)) return "Utilities";
  if (/FEES|TAX|STAMP DUTY/i.test(n)) return "Fees";
  if (/MICROSOFT|APPLE|GOOGLE|OPENAI|TRAE/i.test(n)) return "Licenses";
  if (/AMAZON/i.test(n)) return "Others";
  if (/APACHE PIZZA|SPAR EAST|EDDIE ROCKETS/i.test(n)) return "Eating Out";
  if (/LEAP CARD|IRISH RAIL/i.test(n)) return "Transport";
  if (/HUMMGROUP|FOOT LOCKER/i.test(n)) return "Gifts";
  if (/PLATINUM/i.test(n)) return "Gym";
  if (/GUSTAVO|HPNUTRITION|SP DISCOUNT|IHERB|VITAMIN SHOP|MOV &|/i.test(n)) return "Self-Care";
  if (/PREMIER LOTT|IKEA|PENNEYS|HUMMGROUP|AMAZON.IE/i.test(n)) return "Others";
  if (/PYEU|FABIO|REV|SALARY/i.test(n)) return "Income";
  return "Uncategorized";
};

const isAIB = (row) =>
  Object.prototype.hasOwnProperty.call(row, "Posted Transactions Date") ||
  Object.prototype.hasOwnProperty.call(row, "Debit Amount") ||
  Object.prototype.hasOwnProperty.call(row, "Credit Amount");

const normalizeAIB = (rows) =>
  rows
    .map((r) => {
      const date = toIsoDate(r["Posted Transactions Date"]);
      const debit = parseNumber(r["Debit Amount"]);
      const credit = parseNumber(r["Credit Amount"]);
      const type =
        credit > 0 ? "income" : debit > 0 ? "expense" : (r["Transaction Type"] || "").toLowerCase().includes("credit") ? "income" : "expense";
      const amount = type === "income" ? credit : debit;
      const nameRaw =
        buildDescription(r, ["Description1", "Description2", "Description3"]) ||
        (r["Description1"] || "").trim();
      const name = cleanName(nameRaw);
      const category = type === "income" ? "Income" : deriveCategory(name);

      if (!date || amount <= 0) return null;

      return { type, name, amount, date, category };
    })
    .filter(Boolean);

const fallbackNormalize = (rows) =>
  rows
    .map((r) => {
      const date =
        r.date || r.Date || r["Transaction Date"] || r["Posted Transactions Date"];
      const iso = toIsoDate(date) || (dayjs(date).isValid() ? dayjs(date).format("YYYY-MM-DD") : null);

      const debit = parseNumber(r.debit || r.Debit || r["Debit Amount"]);
      const credit = parseNumber(r.credit || r.Credit || r["Credit Amount"]);
      let amount = 0;
      let type = "expense";

      if (credit > 0) {
        amount = credit;
        type = "income";
      } else if (debit > 0) {
        amount = debit;
        type = "expense";
      } else {
        const a = parseNumber(r.amount || r.Amount || r["Local Currency Amount"]);
        if (a < 0) {
          amount = Math.abs(a);
          type = "expense";
        } else {
          amount = a;
          type = "income";
        }
      }

      const nameRaw =
        buildDescription(r, ["Description1", "Description2", "Description3"]) ||
        r.description ||
        r.Description ||
        r["Description1"] ||
        "";
      const name = cleanName(nameRaw);

      const category = type === "income" ? "Income" : deriveCategory(name);

      if (!iso || amount <= 0) return null;

      return { type, name: String(name).trim(), amount, date: iso, category };
    })
    .filter(Boolean);

const normalizeBankRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const sample = rows[0] || {};
  return isAIB(sample) ? normalizeAIB(rows) : fallbackNormalize(rows);
};

module.exports = { normalizeBankRows };