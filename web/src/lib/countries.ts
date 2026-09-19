// Launch-market shortlist with default currencies (SCR-03 prefills currency from country).
export const COUNTRIES: [code: string, currency: string][] = [
  ["IN", "INR"], ["AE", "AED"], ["AU", "AUD"], ["BD", "BDT"], ["CA", "CAD"], ["DE", "EUR"], ["ES", "EUR"], ["FR", "EUR"],
  ["GB", "GBP"], ["ID", "IDR"], ["IE", "EUR"], ["IT", "EUR"], ["JP", "JPY"], ["KE", "KES"], ["KW", "KWD"], ["LK", "LKR"],
  ["MY", "MYR"], ["NG", "NGN"], ["NL", "EUR"], ["NP", "NPR"], ["NZ", "NZD"], ["PH", "PHP"], ["PK", "PKR"], ["QA", "QAR"],
  ["SA", "SAR"], ["SG", "SGD"], ["TH", "THB"], ["US", "USD"], ["ZA", "ZAR"],
];

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string) => names.of(code) ?? code;
export const currencyOf = (country: string) => COUNTRIES.find(([c]) => c === country)?.[1] ?? "USD";
export const CURRENCIES = [...new Set(COUNTRIES.map(([, c]) => c))].sort();
