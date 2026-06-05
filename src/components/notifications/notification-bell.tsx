'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  notificationApi,
  type Notification,
  getCurrentProjectId,
} from '@/lib/api';
import { buildReportsLocation } from '@/lib/report-navigation';
import { cn } from '@/lib/utils';
import { useRouter } from '@/i18n/navigation';

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const projectId = getCurrentProjectId() ?? undefined;

  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount(projectId);
      setCount(res.count);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const openDropdown = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await notificationApi.list(projectId, 0, 10);
      setNotifications(res.notifications);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
    setCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    await notificationApi.markAllRead(projectId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setCount(0);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={open ? () => setOpen(false) : openDropdown}
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Notificações</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleMarkAll}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                    !n.is_read && 'bg-muted/30'
                  )}
                  onClick={() => {
                    if (!n.is_read) handleMarkRead(n.id);
                    if (n.type === 'report_ready') {
                      setOpen(false);
                      router.push(buildReportsLocation(n.data));
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', !n.is_read && 'font-semibold')}>{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              className="w-full text-xs h-8"
              onClick={() => {
                setOpen(false);
                router.push('/telephony/reports');
              }}
            >
              Ver todos os relatórios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
