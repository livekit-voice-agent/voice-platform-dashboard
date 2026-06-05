type ReportActionLike = {
  id?: string;
  status: string;
  s3_url?: string | null;
};

export function getReportDownloadAction(
  report: ReportActionLike,
  downloadingReportId: string | null
) {
  const isReady = report.status === "DONE" && !!report.s3_url;
  const isDownloading = !!report.id && downloadingReportId === report.id;

  if (!isReady) {
    return {
      visible: false,
      disabled: true,
      label: "Indisponível",
    };
  }

  return {
    visible: true,
    disabled: isDownloading,
    label: isDownloading ? "Baixando..." : "Baixar relatório",
  };
}
