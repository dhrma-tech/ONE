/// <reference lib="webworker" />
// Pyodide Web Worker: loads python-chess + the local `bobby` package from public/py and runs bobby.api functions.
// Protocol: in {id, fn, args} -> out {id, ok:true, value} | {id, ok:false, error, kind}. Values cross as JSON strings.

interface PyodideLike {
  FS: { mkdirTree(p: string): void; writeFile(p: string, d: string | Uint8Array): void };
  runPython(code: string): unknown;
  runPythonAsync(code: string): Promise<unknown>;
  loadPackage(names: string | string[]): Promise<unknown>;
  globals: { get(name: string): unknown };
}

// The main thread passes the app root URL (the directory holding pyodide/, py/, engine/).

let ready: Promise<{ py: PyodideLike; hasApi: boolean; apiFns: string[] }> | null = null;

async function boot(appRoot: string) {
  const indexURL = new URL("pyodide/", appRoot).href;
  const mod = (await import(/* @vite-ignore */ indexURL + "pyodide.mjs")) as { loadPyodide(o: { indexURL: string }): Promise<PyodideLike> };
  const py = await mod.loadPyodide({ indexURL });
  const pyRoot = new URL("py/", appRoot).href;
  const manifest = (await (await fetch(pyRoot + "files.json", { cache: "no-cache" })).json()) as { files: string[] };
  const dir = "/home/pyodide/lib";
  await Promise.all(manifest.files.map(async (f) => {
    const text = await (await fetch(pyRoot + f)).text();
    const p = `${dir}/${f}`;
    py.FS.mkdirTree(p.slice(0, p.lastIndexOf("/")));
    py.FS.writeFile(p, text);
  }));
  if (!manifest.files.some((f) => f.startsWith("chess/"))) {
    await py.loadPackage("micropip");
    await py.runPythonAsync(`import micropip\nawait micropip.install("chess")`);
  }
  py.runPython(`
import sys, json, importlib, traceback
sys.path.insert(0, "${dir}")
try:
    import bobby.api as _api
    _has_api = True
except Exception as _e:
    _api = None
    _has_api = False
    _api_err = "".join(traceback.format_exception(_e))
def _bobby_fns():
    if _api is None: return json.dumps([])
    return json.dumps([n for n in dir(_api) if not n.startswith("_") and callable(getattr(_api, n))])
def _bobby_call(fn, args_json):
    f = getattr(_api, fn, None) if _api is not None else None
    if f is None:
        return json.dumps({"__missing__": fn})
    try:
        return json.dumps({"__ok__": f(*json.loads(args_json))})
    except ValueError as e:
        return json.dumps({"__err__": str(e), "kind": "ValueError"})
    except Exception as e:
        return json.dumps({"__err__": "".join(traceback.format_exception(e))[-2000:], "kind": type(e).__name__})
`);
  const hasApi = Boolean(py.globals.get("_has_api"));
  const fnsFn = py.globals.get("_bobby_fns") as () => string;
  const apiFns = JSON.parse(fnsFn()) as string[];
  if (!hasApi) console.warn("[bobby/py] bobby.api not importable:", String(py.globals.get("_api_err") ?? ""));
  return { py, hasApi, apiFns };
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { id: number; fn: string; args?: unknown[]; root?: string };
  try {
    if (m.fn === "__init__") {
      ready ??= boot(m.root ?? new URL("/", self.location.href).href);
      const r = await ready;
      postMessage({ id: m.id, ok: true, value: { hasApi: r.hasApi, fns: r.apiFns } });
      return;
    }
    if (!ready) throw new Error("worker not initialised");
    const { py } = await ready;
    const call = py.globals.get("_bobby_call") as (fn: string, a: string) => string;
    const out = JSON.parse(call(m.fn, JSON.stringify(m.args ?? []))) as { __ok__?: unknown; __err__?: string; __missing__?: string; kind?: string };
    if ("__missing__" in out) postMessage({ id: m.id, ok: false, error: `bobby.api.${m.fn} not found`, kind: "missing" });
    else if ("__err__" in out) postMessage({ id: m.id, ok: false, error: out.__err__, kind: out.kind });
    else postMessage({ id: m.id, ok: true, value: out.__ok__ });
  } catch (err) {
    postMessage({ id: m.id, ok: false, error: String((err as Error)?.message ?? err), kind: "boot" });
  }
};
