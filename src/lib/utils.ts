export const BRAND_ORANGE = '#f37021';
export const CURRENT_YEAR = 2022;
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions) =>
	new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, ...options }).format(n);

