import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { RefreshCw, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Logs() {
  const { data: logs = [], refetch, isLoading } = trpc.logs.list.useQuery({ limit: 100 });
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'startup':
        return <CheckCircle className="w-4 h-4 text-primary" />;
      case 'restart':
        return <RotateCcw className="w-4 h-4 text-secondary" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <RefreshCw className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventBadge = (eventType: string) => {
    const baseClass = 'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium';
    switch (eventType) {
      case 'startup':
        return `${baseClass} bg-primary/10 text-primary`;
      case 'restart':
        return `${baseClass} bg-secondary/10 text-secondary`;
      case 'error':
        return `${baseClass} bg-destructive/10 text-destructive`;
      default:
        return `${baseClass} bg-muted/20 text-muted-foreground`;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'startup':
        return '启动';
      case 'restart':
        return '重启';
      case 'error':
        return '错误';
      default:
        return '检查';
    }
  };

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* 装饰元素 */}
      <div className="organic-blob-1" />
      <div className="organic-blob-2" />
      <div className="organic-blob-3" />

      <div className="relative z-10">
        {/* 页面头部 */}
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="container py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-1">实时日志</h1>
                <p className="label-uppercase">监控系统运行事件和容器状态变化</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant={autoRefresh ? 'default' : 'outline'}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {autoRefresh ? '自动刷新中' : '手动刷新'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {logs.length === 0 ? (
            <Card className="card-elevated text-center py-12">
              <p className="text-muted-foreground mb-4">暂无日志记录</p>
              <p className="text-sm text-muted-foreground">启动容器或执行操作后，日志将显示在这里</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card key={log.id} className="card-elevated">
                  <div className="flex items-start gap-4">
                    {/* 事件图标 */}
                    <div className="flex-shrink-0 pt-1">
                      {getEventIcon(log.eventType)}
                    </div>

                    {/* 日志内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-foreground">{log.containerName}</span>
                        <span className={getEventBadge(log.eventType)}>
                          {getEventLabel(log.eventType)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{log.message}</p>
                      <p className="text-xs text-muted-foreground/60">
                        {formatTime(new Date(log.createdAt))}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
