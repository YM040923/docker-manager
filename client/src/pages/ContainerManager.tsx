import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { GripVertical, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ContainerDiscovery } from '@/components/ContainerDiscovery';

export default function ContainerManager() {
  const { data: containers = [], refetch: refetchContainers } = trpc.containers.list.useQuery();
  const updateMutation = trpc.containers.update.useMutation();
  const deleteMutation = trpc.containers.delete.useMutation();
  const reorderMutation = trpc.containers.reorder.useMutation();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, { delay: string; monitor: boolean }>>({});

  const handleDragStart = (id: number) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetId: number) => {
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = containers.findIndex(c => c.id === draggedId);
    const targetIndex = containers.findIndex(c => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newContainers = [...containers];
    [newContainers[draggedIndex], newContainers[targetIndex]] = [newContainers[targetIndex], newContainers[draggedIndex]];

    const reorderedItems = newContainers.map((c, idx) => ({
      id: c.id,
      startupOrder: idx,
    }));

    try {
      await reorderMutation.mutateAsync({ items: reorderedItems });
      refetchContainers();
      setDraggedId(null);
      toast.success('启动顺序已更新');
    } catch (error) {
      toast.error('更新失败');
    }
  };

  const handleEdit = (container: any) => {
    setEditingId(container.id);
    setEditValues({
      ...editValues,
      [container.id]: {
        delay: container.startupDelay.toString(),
        monitor: container.monitor === 1,
      },
    });
  };

  const handleSave = async (id: number) => {
    const values = editValues[id];
    if (!values) return;

    try {
      await updateMutation.mutateAsync({
        id,
        startupDelay: parseInt(values.delay) || 0,
        monitor: values.monitor,
      });
      refetchContainers();
      setEditingId(null);
      toast.success('容器配置已更新');
    } catch (error) {
      toast.error('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此容器配置吗？')) return;

    try {
      await deleteMutation.mutateAsync(id);
      refetchContainers();
      toast.success('容器已删除');
    } catch (error) {
      toast.error('删除失败');
    }
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
          <div className="container py-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">启动顺序管理</h1>
              <p className="label-uppercase">拖拽调整容器启动顺序，配置延迟时间和监控开关</p>
            </div>
            <ContainerDiscovery />
          </div>
        </div>

        <div className="container py-8">
          {containers.length === 0 ? (
            <Card className="card-elevated text-center py-12">
              <p className="text-muted-foreground mb-4">暂无容器配置</p>
              <Button className="bg-primary">返回仪表盘添加容器</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {containers.map((container, index) => (
                <Card
                  key={container.id}
                  draggable
                  onDragStart={() => handleDragStart(container.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(container.id)}
                  className={`card-elevated cursor-move transition-all ${
                    draggedId === container.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* 拖拽手柄 */}
                    <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                    {/* 顺序号 */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{index + 1}</span>
                    </div>

                    {/* 容器信息 */}
                    <div className="flex-1 min-w-0">
                      {editingId === container.id ? (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">容器名称</Label>
                            <p className="font-semibold text-foreground">{container.name}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`delay-${container.id}`} className="text-xs">启动延迟 (秒)</Label>
                              <Input
                                id={`delay-${container.id}`}
                                type="number"
                                min="0"
                                value={editValues[container.id]?.delay || '0'}
                                onChange={(e) => setEditValues({
                                  ...editValues,
                                  [container.id]: {
                                    ...editValues[container.id],
                                    delay: e.target.value,
                                  },
                                })}
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <Label htmlFor={`monitor-${container.id}`} className="text-xs">启用监控</Label>
                              <Switch
                                id={`monitor-${container.id}`}
                                checked={editValues[container.id]?.monitor || false}
                                onCheckedChange={(checked) => setEditValues({
                                  ...editValues,
                                  [container.id]: {
                                    ...editValues[container.id],
                                    monitor: checked,
                                  },
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h3 className="font-semibold text-foreground">{container.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                            <span>延迟: {container.startupDelay}s</span>
                            <span className={container.monitor === 1 ? 'status-running' : 'status-stopped'}>
                              {container.monitor === 1 ? '监控中' : '未监控'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {editingId === container.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleSave(container.id)}
                            disabled={updateMutation.isPending}
                            className="bg-primary text-xs"
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="text-xs"
                          >
                            取消
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(container)}
                            className="text-xs"
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(container.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
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
