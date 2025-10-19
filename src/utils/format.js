const defaultCurrency = process.env.REACT_APP_CURRENCY || "EUR";
const defaultLocale = process.env.REACT_APP_LOCALE || "en-GB";

const currencyFormatter = new Intl.NumberFormat(defaultLocale, {
  style: "currency",
  currency: defaultCurrency,
  minimumFractionDigits: 2,
});

export const formatCurrency = (value) =>
  currencyFormatter.format(Number(value) || 0);

export const formatPercentage = (value, fractionDigits = 1) =>
  `${Number(value || 0).toFixed(fractionDigits)}%`;
