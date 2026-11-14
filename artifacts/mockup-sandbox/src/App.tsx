import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";

import { modules as discoveredModules } from "./.generated/mockup-components";
import { SoundSystemProvider } from "./components/mockups/colony-frontier/_shared/SoundSystem";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (v) => typeof v === "function",
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error("Preview component crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      const error = this.state.error;
      return (
        <div style={{ minHeight: "100vh", padding: "2rem", background: "#071017", color: "#eaf1e8", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", border: "1px solid #70483e", background: "#1a1113", padding: "1.5rem" }}>
            <div style={{ color: "#ff8170", fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Preview crashed while rendering
            </div>
            <h1 style={{ marginTop: 10, fontSize: 22 }}>Mission Simulation Error</h1>
            <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", color: "#ffc5ba", fontSize: 13, lineHeight: 1.6 }}>
              {error.message}
            </pre>
            {error.stack && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", color: "#efb658", fontSize: 12 }}>Show stack trace</summary>
                <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "#9eb0aa", fontSize: 11, lineHeight: 1.5 }}>
                  {error.stack}
                </pre>
              </details>
            )}
            <a
              href="/preview/CampaignMapRefresh"
              style={{ display: "inline-flex", marginTop: 20, background: "#efb658", color: "#17201b", padding: "10px 14px", fontSize: 11, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.12em" }}
            >
              Return to campaign
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      const key = `./components/mockups/colony-frontier/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      try {
        const mod = await loader();
        if (cancelled) {
          return;
        }
        const name = componentPath.split("/").pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          setError(
            `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
          );
          return;
        }
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        setError(`Failed to load preview.\n${message}`);
      }
    }

    void loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) {
    return (
      <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>
        {error}
      </pre>
    );
  }

  if (!Component) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#040a0e", color: "#9eb0aa", fontFamily: "system-ui, sans-serif" }}>
        Loading preview…
      </div>
    );
  }

  return (
    <PreviewErrorBoundary>
      <SoundSystemProvider>
        <Component />
      </SoundSystemProvider>
    </PreviewErrorBoundary>
  );
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getPreviewExamplePath(): string {
  const basePath = getBasePath();
  return `${basePath}/preview/ComponentName`;
}

function Gallery() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Component Preview Server
        </h1>
        <p className="text-gray-500 mb-4">
          This server renders individual components for the workspace canvas.
        </p>
        <p className="text-sm text-gray-400">
          Access component previews at{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {getPreviewExamplePath()}
          </code>
        </p>
      </div>
    </div>
  );
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const match = local.match(/^\/preview\/(.+?)(?:\.tsx)?$/);
  return match ? match[1] : null;
}

function App() {
  const previewPath = getPreviewPath();

  if (previewPath) {
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  return <Gallery />;
}

export default App;
