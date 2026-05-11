import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Settings() {
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation();
  const [checkInterval, setCheckInterval] = useState('60');

  useEffect(() => {
    if (settings) {
      setCheckInterval(settings.checkInterval?.toString() || '60');
    }
  }, [settings]);

  const handleSave = async () => {
    const interval = parseInt(checkInterval) || 60;
    if (interval < 5) {
      toast.error('检查间隔最少为 5 秒');
      return;
    }

    try {
      await updateMutation.mutateAsync({ checkInterval: interval });
      toast.success('设置已保存');
    } catch (error) {
      toast.error('保存失败');
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
          <div className="container py-6">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-1">全局设置</h1>
                <p className="label-uppercase">配置容器监控的全局参数</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="max-w-2xl">
            <Card className="card-elevated">
              <div className="space-y-6">
                {/* 检查间隔设置 */}
                <div>
                  <Label htmlFor="check-interval" className="text-base font-semibold mb-2 block">
                    健康检查间隔
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    系统将按照此间隔定时检查容器状态，如果容器未运行则尝试重启。
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      id="check-interval"
                      type="number"
                      min="5"
                      step="5"
                      value={checkInterval}
                      onChange={(e) => setCheckInterval(e.target.value)}
                      className="max-w-xs"
                    />
                    <span className="text-sm text-muted-foreground">秒</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    推荐值: 60 秒 (最小值: 5 秒)
                  </p>
                </div>

                {/* 说明信息 */}
                <div className="pt-4 border-t border-border/50">
                  <h3 className="font-semibold text-foreground mb-3">工作原理</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">1.</span>
                      <span>系统启动时，按照容器列表中的顺序依次启动容器</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">2.</span>
                      <span>每个容器启动后，等待其配置的延迟时间再启动下一个</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">3.</span>
                      <span>启动完成后，系统进入监控模式</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">4.</span>
                      <span>每隔 check_interval 秒检查一次已启用监控的容器</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold">5.</span>
                      <span>如果发现容器未运行，立即尝试重启</span>
                    </li>
                  </ul>
                </div>

                {/* 保存按钮 */}
                <div className="pt-4 border-t border-border/50 flex gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending || isLoading}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    <Save className="w-4 h-4" />
                    {updateMutation.isPending ? '保存中...' : '保存设置'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* 日志说明 */}
            <Card className="card-elevated mt-6">
              <h3 className="font-semibold text-foreground mb-3">日志说明</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <div className="w-20 flex-shrink-0">
                    <span className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">启动</span>
                  </div>
                  <span>容器启动事件，记录容器启动的时间和结果</span>
                </div>
                <div className="flex gap-3">
                  <div className="w-20 flex-shrink-0">
                    <span className="inline-block px-2 py-1 bg-secondary/10 text-secondary rounded text-xs font-medium">重启</span>
                  </div>
                  <span>自动重启事件，当监控发现容器未运行时记录</span>
                </div>
                <div className="flex gap-3">
                  <div className="w-20 flex-shrink-0">
                    <span className="inline-block px-2 py-1 bg-muted/20 text-muted-foreground rounded text-xs font-medium">检查</span>
                  </div>
                  <span>定时状态检查事件，记录每次监控检查</span>
                </div>
                <div className="flex gap-3">
                  <div className="w-20 flex-shrink-0">
                    <span className="inline-block px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium">错误</span>
                  </div>
                  <span>错误事件，记录启动或重启失败的情况</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
