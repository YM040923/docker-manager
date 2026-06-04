import { useEffect, useState } from "react";
import { Route, Router, Switch } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { appPath } from "@/lib/appBase";
import Navigation from "./components/Navigation";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ContainerManager from "./pages/ContainerManager";
import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

type AuthState = {
  authenticated: boolean;
  username: string | null;
  mode: "fnos" | "local";
};

const routerBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

function AccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h1 className="text-xl font-semibold mb-2">需要飞牛管理员权限</h1>
        <p className="text-sm text-muted-foreground">
          统一网关已拦截未登录用户。本应用只允许飞牛管理员账号访问容器管理功能。
        </p>
      </Card>
    </div>
  );
}

function AppRoutes() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  const checkAuth = async () => {
    try {
      const res = await fetch(appPath("/api/auth/check"), { credentials: "include" });
      const data = await res.json();
      setAuth({
        authenticated: Boolean(data.authenticated),
        username: data.username ?? null,
        mode: data.mode === "fnos" ? "fnos" : "local",
      });
    } catch {
      setAuth({ authenticated: false, username: null, mode: "local" });
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (auth === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!auth.authenticated) {
    return auth.mode === "fnos" ? <AccessDenied /> : <Login onLogin={checkAuth} />;
  }

  return (
    <Router base={routerBase}>
      <Navigation mode={auth.mode} username={auth.username} />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/containers" component={ContainerManager} />
        <Route path="/settings" component={Settings} />
        <Route path="/logs" component={Logs} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
