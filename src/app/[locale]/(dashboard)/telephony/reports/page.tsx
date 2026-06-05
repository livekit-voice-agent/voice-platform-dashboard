'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  reportApi,
  agentConfigApi,
  type Report,
  type ReportType,
  getCurrentProjectId,
} from '@/lib/api';
import { getReportDownloadAction } from '@/lib/report-download-action';
import { getReportDownloadFileName, reportMatchesSelection } from '@/lib/report-navigation';
import { getScrollableCellClass, getStickyColumnClass } from '@/lib/report-table-layout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, FileText, Info, Loader2, Plus, RefreshCw } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  GENERATING: 'Gerando',
  DONE: 'Pronto',
  ERROR: 'Erro',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  GENERATING: 'outline',
  DONE: 'default',
  ERROR: 'destructive',
};

function formatDate(val: string | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleString();
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const projectId = getCurrentProjectId() ?? '';
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  const [reportType, setReportType] = useState<ReportType>('PROJECT');
  const [agents, setAgents] = useState<string[]>([]);
  const [filterAgentName, setFilterAgentName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const selectedReportId = searchParams.get('reportId');
  const selectedReportUrl = searchParams.get('reportUrl');

  const fetchReports = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await reportApi.list(projectId);
      setReports(res.reports);
      setTotal(res.total);
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 15_000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  useEffect(() => {
    if (!reports.length || (!selectedReportId && !selectedReportUrl)) return;

    const highlightedRow = document.querySelector('[data-highlighted="true"]');
    if (highlightedRow instanceof HTMLElement) {
      highlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [reports, selectedReportId, selectedReportUrl]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await reportApi.create({
        type: reportType,
        project_id: projectId,
        filters: {
          ...(filterAgentName && { agentName: filterAgentName }),
          ...(filterStatus && { status: filterStatus }),
          ...(filterPhone && { phoneNumber: filterPhone }),
          ...(filterDateFrom && { dateFrom: new Date(filterDateFrom).toISOString() }),
          ...(filterDateTo && { dateTo: new Date(filterDateTo + 'T23:59:59').toISOString() }),
        },
      });
      toast.success('Relatório solicitado! Você será notificado quando estiver pronto.');
      setShowCreate(false);
      fetchReports();
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao solicitar relatório');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    if (!report.s3_url) return;

    setDownloadingReportId(report.id);
    try {
      const res = await fetch(report.s3_url);
      if (!res.ok) {
        throw new Error('Erro ao baixar relatório');
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = getReportDownloadFileName(report);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar relatório');
    } finally {
      setDownloadingReportId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">{total} relatório(s) no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => {
            agentConfigApi.listAgents().then(setAgents).catch(() => {});
            setShowCreate(true);
          }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Gerar relatório
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border">
        <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Criado em</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Filtros</TableHead>
              <TableHead className={`${getStickyColumnClass('completedAt')} min-w-[172px]`}>Concluído em</TableHead>
              <TableHead className={`${getStickyColumnClass('action')} min-w-[172px] text-right`}>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  Nenhum relatório encontrado
                </TableCell>
              </TableRow>
            ) : (
              reports.map(r => {
                const isHighlighted = reportMatchesSelection(r, selectedReportId, selectedReportUrl);
                const action = getReportDownloadAction(r, downloadingReportId);

                return (
                  <TableRow
                    key={r.id}
                    data-highlighted={isHighlighted ? 'true' : undefined}
                    className={isHighlighted ? 'bg-primary/5' : undefined}
                  >
                    <TableCell className="text-sm">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-sm">
                      {r.type === 'PROJECT' ? 'Projeto' : 'Individual'}
                    </TableCell>
                    <TableCell>
                      <div className={getScrollableCellClass()}>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={STATUS_VARIANTS[r.status]}>
                            {STATUS_LABELS[r.status]}
                          </Badge>
                          {r.status === 'GENERATING' && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        {r.status === 'ERROR' && r.error_message && (
                          <p className="mt-0.5 text-[11px] text-destructive whitespace-nowrap">{r.error_message}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className={getScrollableCellClass()}>
                        {Object.entries(r.filters ?? {})
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ') || '—'}
                      </div>
                    </TableCell>
                    <TableCell className={`${getStickyColumnClass('completedAt')} min-w-[172px] text-sm ${isHighlighted ? 'bg-primary/5' : 'bg-background'}`}>
                      {formatDate(r.completed_at)}
                    </TableCell>
                    <TableCell className={`${getStickyColumnClass('action')} min-w-[172px] text-right ${isHighlighted ? 'bg-primary/5' : 'bg-background'}`}>
                      {!action.visible ? '—' : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[140px] justify-center gap-1.5"
                          onClick={() => handleDownload(r)}
                          disabled={action.disabled}
                        >
                          {action.disabled ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {action.label}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Create Report Modal */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) {
          setFilterAgentName('');
          setFilterStatus('');
          setFilterPhone('');
          setFilterDateFrom('');
          setFilterDateTo('');
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar relatório</DialogTitle>
            <DialogDescription>
              O relatório será gerado em segundo plano. Você será notificado quando estiver pronto.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de relatório</Label>
              <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROJECT">Projeto completo</SelectItem>
                  <SelectItem value="INDIVIDUAL">Sessão individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtros section */}
            <div className="rounded-lg border p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">Filtros</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Deixar em branco inclui todos os dados
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Agente</Label>
                  <Select
                    value={filterAgentName || "all"}
                    onValueChange={v => setFilterAgentName(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="completed">completed</SelectItem>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="failed">failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="+5511..."
                  value={filterPhone}
                  onChange={e => setFilterPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input className="h-8 text-xs" type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input className="h-8 text-xs" type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
