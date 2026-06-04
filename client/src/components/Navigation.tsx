import { Link, useLocation } from "wouter";
import { Boxes, FileText, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { appPath } from "@/lib/appBase";

type NavigationProps = {
  mode?: "fnos" | "local";
  username?: string | null;
};

export default function Navigation({ mode = "local", username }: NavigationProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "仪表盘" },
    { path: "/containers", icon: Boxes, label: "启动顺序" },
    { path: "/settings", icon: Settings, label: "设置" },
    { path: "/logs", icon: FileText, label: "日志" },
  ];

  const handleLogout = async () => {
    try {
      await fetch(appPath("/api/logout"), { method: "POST", credentials: "include" });
      window.location.reload();
    } catch {
      toast.error("退出失败");
    }
  };

  return (
    <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Boxes className="w-6 h-6 text-primary" />
          <span className="text-lg font-bold text-foreground">Docker Manager</span>
        </div>

        <div className="flex items-center gap-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link key={path} href={path}>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                location === path
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            </Link>
          ))}
          {username && (
            <span className="ml-3 px-3 py-2 text-sm text-muted-foreground">
              {username}
            </span>
          )}
          {mode === "local" && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer text-foreground hover:bg-muted"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">退出</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
