const FORMATS = {
  '2dec':   { locale: 'en-US', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  '0dec':   { locale: 'en-US', minimumFractionDigits: 0, maximumFractionDigits: 0 },
  'eu2dec': { locale: 'de-DE', minimumFractionDigits: 2, maximumFractionDigits: 2 },
  'eu0dec': { locale: 'de-DE', minimumFractionDigits: 0, maximumFractionDigits: 0 },
};

export function formatNumber(n, numberFormat = '2dec') {
  if (n == null || isNaN(n)) return '0.00';
  const fmt = FORMATS[numberFormat] || FORMATS['2dec'];
  return n.toLocaleString(fmt.locale, {
    minimumFractionDigits: fmt.minimumFractionDigits,
    maximumFractionDigits: fmt.maximumFractionDigits,
  });
}

export const FORMAT_LABELS = {
  '2dec': '1,234.56',
  '0dec': '1,235',
  'eu2dec': '1.234,56',
  'eu0dec': '1.235',
};

export const FORMAT_ORDER = ['2dec', '0dec', 'eu2dec', 'eu0dec'];
