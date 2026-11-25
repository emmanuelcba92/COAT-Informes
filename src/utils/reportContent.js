export const REPORT_PAGE_BREAK = 'data-report-page-break';

export function isReportImageSource(src) {
  return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=]+$/i.test(src || '');
}
