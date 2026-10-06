import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { debug, type Tracer } from "@saarthi/core";

export interface ViewerServerOptions {
  tracer: Tracer;
  port?: number;
  host?: string;
  staticDir?: string;
}

export interface ViewerServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".map": "application/json; charset=utf-8",
};

export async function startViewerServer(
  options: ViewerServerOptions,
): Promise<ViewerServer> {
  const { tracer } = options;
  const clients = new Set<ServerResponse>();

  const unsubscribe = tracer.subscribe((event) => {
    const frame = `event: span\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      client.write(frame);
    }
  });

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.split("?")[0] === "/events") {
      handleEvents(req, res, tracer, clients);
      return;
    }
    if (url.split("?")[0] === "/snapshot") {
      res.writeHead(200, { "content-type": CONTENT_TYPES[".json"]! });
      res.end(JSON.stringify(tracer.snapshot()));
      return;
    }
    if (options.staticDir && serveStatic(url, res, options.staticDir)) {
      return;
    }
    serveFallback(res, tracer);
  });

  const host = options.host ?? "127.0.0.1";
  await listen(server, options.port ?? 4318, host);
  const address = server.address();
  const port =
    typeof address === "object" && address
      ? address.port
      : (options.port ?? 4318);
  const url = `http://${host}:${port}`;
  debug("next", "viewer:listening", { url });

  return {
    url,
    port,
    close: () =>
      new Promise<void>((done) => {
        unsubscribe();
        for (const client of clients) client.end();
        server.close(() => done());
      }),
  };
}

function handleEvents(
  req: IncomingMessage,
  res: ServerResponse,
  tracer: Tracer,
  clients: Set<ServerResponse>,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write(
    `event: trace\ndata: ${JSON.stringify({ traceId: tracer.traceId })}\n\n`,
  );
  res.write(`event: snapshot\ndata: ${JSON.stringify(tracer.snapshot())}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
  debug("next", "viewer:client", { clients: clients.size });
}

function serveStatic(
  url: string,
  res: ServerResponse,
  dir: string,
): boolean {
  const pathname = url.split("?")[0] ?? "/";
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const full = normalize(join(dir, relative));
  const root = resolve(dir);
  if (!full.startsWith(root)) return false;
  if (!existsSync(full) || !statSync(full).isFile()) return false;
  res.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(full)] ?? "application/octet-stream",
  });
  res.end(readFileSync(full));
  return true;
}

function serveFallback(res: ServerResponse, tracer: Tracer): void {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Saarthi</title>
<style>
body{background:#0b0e14;color:#cdd6f4;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;padding:16px}
h1{font-size:14px;font-weight:600;margin:0 0 12px}
.row{display:flex;gap:10px;padding:3px 6px;border-radius:4px}
.name{flex:0 0 200px}
.ms{flex:0 0 90px;text-align:right}
.file{color:#6c7086}
.done{color:#a6e3a1}.running{color:#89b4fa}.waiting{color:#9399b2}.failed{color:#f38ba8}
</style></head><body>
<h1>Saarthi — live trace <span id="t"></span></h1>
<div id="rows"></div>
<script>
const rows=document.getElementById('rows');
const spans=new Map();
function render(){
  rows.innerHTML='';
  for(const s of spans.values()){
    const d=document.createElement('div');d.className='row';
    const total=s.end==null?'…':(s.end-s.start).toFixed(2)+'ms';
    d.innerHTML='<span class="name '+s.status+'">'+s.name+'</span>'+
      '<span class="ms">'+total+'</span>'+
      '<span class="file">'+s.file+':'+s.line+'</span>';
    rows.appendChild(d);
  }
}
const es=new EventSource('/events');
es.addEventListener('trace',e=>{document.getElementById('t').textContent=JSON.parse(e.data).traceId});
es.addEventListener('snapshot',e=>{for(const s of JSON.parse(e.data).spans)spans.set(s.id,s);render()});
es.addEventListener('span',e=>{const ev=JSON.parse(e.data);spans.set(ev.span.id,ev.span);render()});
</script></body></html>`;
  res.writeHead(200, { "content-type": CONTENT_TYPES[".html"]! });
  res.end(html);
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => {
      server.off("error", fail);
      done();
    });
  });
}
