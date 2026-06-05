type NotificationData = Record<string, unknown> | undefined;

type ReportLike = {
  id: string;
  type: string;
  created_at?: string;
  s3_url?: string | null;
};

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function buildReportsLocation(data?: NotificationData): string {
  const params = new URLSearchParams();
  const reportId =
    getStringValue(data?.reportId) ??
    getStringValue(data?.report_id) ??
    getStringValue(data?.id);
  const reportUrl = getStringValue(data?.reportUrl) ?? getStringValue(data?.report_url);

  if (reportId) {
    params.set("reportId", reportId);
  }

  if (reportUrl) {
    params.set("reportUrl", reportUrl);
  }

  const query = params.toString();
  return query ? `/telephony/reports?${query}` : "/telephony/reports";
}

export function reportMatchesSelection(
  report: Pick<ReportLike, "id" | "s3_url">,
  selectedReportId?: string | null,
  selectedReportUrl?: string | null
): boolean {
  if (selectedReportId && report.id === selectedReportId) {
    return true;
  }

  if (selectedReportUrl && report.s3_url === selectedReportUrl) {
    return true;
  }

  return false;
}

export function getReportDownloadFileName(report: ReportLike): string {
  const normalizedType = report.type === "PROJECT" ? "project" : "individual";
  const extension = (() => {
    if (!report.s3_url) return "csv";
    try {
      const pathname = new URL(report.s3_url).pathname;
      const rawExtension = pathname.split(".").pop()?.toLowerCase();
      return rawExtension && rawExtension.length <= 5 ? rawExtension : "csv";
    } catch {
      return "csv";
    }
  })();

  return `${normalizedType}-report-${report.id}.${extension}`;
}
