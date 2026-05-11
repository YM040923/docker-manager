import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface DiscoveredContainer {
  name: string;
  status: string;
}

export function ContainerDiscovery() {
  const [open, setOpen] = useState(false);
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  
  const { data: discovered = [], isLoading, refetch } = trpc.containers.discover.useQuery(
    undefined,
    { enabled: open }
  );
  
  const createMutation = trpc.containers.create.useMutation({
    onSuccess: () => {
      toast.success('容器已添加');
      setSelectedContainers(new Set());
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || '添加失败');
    },
  });

  const handleToggle = (name: string) => {
    const newSelected = new Set(selectedContainers);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedContainers(newSelected);
  };

  const handleAddSelected = () => {
    if (selectedContainers.size === 0) {
      toast.error('请选择至少一个容器');
      return;
    }

    Array.from(selectedContainers).forEach(containerName => {
      createMutation.mutate({
        name: containerName,
        startupDelay: 0,
        monitor: true,
      });
    });
  };

  const getStatusBadge = (status: string) => {
    if (status.includes('Up')) {
      return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">运行中</span>;
    } else if (status.includes('Exited')) {
      return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive">已停止</span>;
    }
    return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-muted/20 text-muted-foreground">未知</span>;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          自动发现容器
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>发现可用容器</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 刷新按钮 */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新列表
          </Button>

          {/* 容器列表 */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              扫描中...
            </div>
          ) : discovered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              没有发现新容器，所有容器都已添加
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {discovered.map((container: DiscoveredContainer) => (
                <Card
                  key={container.name}
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleToggle(container.name)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedContainers.has(container.name)}
                      onChange={() => handleToggle(container.name)}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{container.name}</p>
                      <p className="text-xs text-muted-foreground">{container.status}</p>
                    </div>
                    {getStatusBadge(container.status)}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          {discovered.length > 0 && (
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleAddSelected}
                disabled={selectedContainers.size === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? '添加中...' : `添加 ${selectedContainers.size} 个容器`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
