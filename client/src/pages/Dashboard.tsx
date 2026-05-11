import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Activity, AlertCircle, CheckCircle2, Play, Power, PowerOff, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Dashboard() {
  const { data: containers = [], isLoading: containersLoading, refetch: refetchContainers } = trpc.containers.status.useQuery();
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = trpc.logs.list.useQuery({ limit: 50 });
  const { data: monitorState, refetch: refetchMonitor } = trpc.management.isMonitoring.useQuery();
  const createContainerMutation = trpc.containers.create.useMutation();
  const startSequenceMutation = trpc.management.startSequence.useMutation();
  const startMonitoringMutation = trpc.management.startMonitoring.useMutation();
  const stopMonitoringMutation = trpc.management.stopMonitoring.useMutation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContainerName, setNewContainerName] = useState('');
  const [newContainerDelay, setNewContainerDelay] = useState('0');
  const [newContainerMonitor, setNewContainerMonitor] = useState(true);

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      refetchContainers();
      refetchLogs();
      refetchMonitor();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetchContainers, refetchLogs, refetchMonitor]);

  const handleAddContainer = async () => {
    if (!newContainerName.trim()) return;
    try {
      await createContainerMutation.mutateAsync({
        name: newContainerName,
        startupDelay: parseInt(newContainerDelay) || 0,
        monitor: newContainerMonitor,
      });
      setNewContainerName('');
      setNewContainerDelay('0');
      setNewContainerMonitor(true);
      setShowAddDialog(false);
      refetchContainers();
    } catch (error) {
      toast.error('添加容器失败');
    }
  };

  const handleStartSequence = async () => {
    try {
      await startSequenceMutation.mutateAsync();
      toast.success('容器启动序列已开始');
      refetchContainers();
      refetchLogs();
    } catch (error) {
      toast.error('启动序列失败');
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      if (monitorState?.monitoring) {
        await stopMonitoringMutation.mutateAsync();
        toast.success('监控已停止');
      } else {
        await startMonitoringMutation.mutateAsync();
        toast.success('监控已启动');
      }
      refetchMonitor();
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const isMonitoring = monitorState?.monitoring ?? false;

  const stats = {
    total: containers.length,
    running: containers.filter(c => c.dockerStatus === 'running').length,
    stopped: containers.filter(c => c.dockerStatus === 'stopped' || c.dockerStatus === 'not_found').length,
  };

  const getStatusBadge = (dockerStatus: string) => {
    if (dockerStatus === 'running') {
      return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">运行中</span>;
    } else if (dockerStatus === 'stopped') {
      return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive">已停止</span>;
    }
    return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-muted/20 text-muted-foreground">未找到</span>;
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
                <h1 className="text-3xl font-bold text-foreground mb-1">Docker 容器管理</h1>
                <p className="label-uppercase">实时监控与启动顺序管理</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-2 bg-primary hover:bg-primary/90"
                  onClick={handleStartSequence}
                  disabled={startSequenceMutation.isPending}
                >
                  <Play className="w-4 h-4" />
                  {startSequenceMutation.isPending ? '启动中...' : '启动容器序列'}
                </Button>
                <Button
                  size="sm"
                  variant={isMonitoring ? 'destructive' : 'outline'}
                  className="gap-2"
                  onClick={handleToggleMonitoring}
                  disabled={startMonitoringMutation.isPending || stopMonitoringMutation.isPending}
                >
                  {isMonitoring ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  {isMonitoring ? '停止监控' : '启动监控'}
                </Button>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="w-4 h-4" />
                      添加容器
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加新容器</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="container-name">容器名称</Label>
                        <Input
                          id="container-name"
                          placeholder="例如: mysql, redis"
                          value={newContainerName}
                          onChange={(e) => setNewContainerName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="startup-delay">启动延迟 (秒)</Label>
                        <Input
                          id="startup-delay"
                          type="number"
                          min="0"
                          value={newContainerDelay}
                          onChange={(e) => setNewContainerDelay(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="monitor-switch">启用监控</Label>
                        <Switch
                          id="monitor-switch"
                          checked={newContainerMonitor}
                          onCheckedChange={setNewContainerMonitor}
                        />
                      </div>
                      <Button
                        onClick={handleAddContainer}
                        disabled={createContainerMutation.isPending}
                        className="w-full bg-primary"
                      >
                        {createContainerMutation.isPending ? '添加中...' : '添加容器'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="card-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-uppercase mb-2">总容器数</p>
                  <p className="text-4xl font-bold text-foreground">{stats.total}</p>
                </div>
                <Activity className="w-12 h-12 text-primary/30" />
              </div>
            </Card>
            <Card className="card-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-uppercase mb-2">容器运行中</p>
                  <p className="text-4xl font-bold text-accent">{stats.running}</p>
                </div>
                <CheckCircle2 className="w-12 h-12 text-accent/30" />
              </div>
            </Card>
            <Card className="card-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-uppercase mb-2">容器已停止</p>
                  <p className="text-4xl font-bold text-destructive">{stats.stopped}</p>
                </div>
                <AlertCircle className="w-12 h-12 text-destructive/30" />
              </div>
            </Card>
          </div>

          {/* 容器列表 */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">容器列表</h2>
            {containersLoading ? (
              <Card className="card-elevated text-center py-8">
                <p className="text-muted-foreground">加载中...</p>
              </Card>
            ) : containers.length === 0 ? (
              <Card className="card-elevated text-center py-8">
                <p className="text-muted-foreground">暂无容器配置，点击上方"添加容器"开始</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {containers.map((container) => (
                  <Card key={container.id} className="card-elevated">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-foreground">{container.name}</h3>
                          {getStatusBadge(container.dockerStatus)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>启动顺序: {container.startupOrder}</span>
                          <span>延迟: {container.startupDelay}s</span>
                          <span className={container.monitor ? 'status-running' : 'status-stopped'}>
                            {container.monitor ? '监控中' : '未监控'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 最近日志 */}
          <div className="mt-12 space-y-4">
            <h2 className="text-xl font-bold text-foreground">最近日志</h2>
            <Card className="card-elevated">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logsLoading ? (
                  <p className="text-muted-foreground text-sm text-center py-4">加载中...</p>
                ) : logs.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">暂无日志</p>
                ) : (
                  logs.slice(0, 20).map((log) => (
                    <div key={log.id} className="pb-3 border-b border-border/50 last:border-0 px-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{log.containerName}</p>
                          <p className="text-xs text-muted-foreground mt-1">{log.message}</p>
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${
                          log.eventType === 'startup' ? 'text-primary' :
                          log.eventType === 'restart' ? 'text-secondary' :
                          log.eventType === 'error' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`}>
                          {log.eventType === 'startup' ? '启动' :
                           log.eventType === 'restart' ? '重启' :
                           log.eventType === 'error' ? '错误' :
                           '检查'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
