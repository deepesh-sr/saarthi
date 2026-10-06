import type { Trace } from "@saarthi/core";

export function buildReportHtml(trace: Trace): string {
  const data = JSON.stringify(trace).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saarthi report — ${escapeHtml(trace.traceId)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div id="root"></div>
<script>window.__SAARTHI_TRACE__=${data};</script>
<script>${REPORT_JS}</script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const REPORT_CSS = `
:root{--bg:#0b0e14;--line:#1e2430;--text:#cdd6f4;--muted:#6c7086;--accent:#cba6f7;--done:#a6e3a1;--running:#89b4fa;--waiting:#9399b2;--failed:#f38ba8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.header{display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)}
.header .muted{color:var(--muted)}
.header .total{margin-left:auto;color:var(--muted)}
.body{display:flex;min-height:60vh}
.sidebar{width:420px;flex:0 0 420px;border-right:1px solid var(--line)}
.bottleneck{padding:10px 12px;border-bottom:1px solid var(--line);background:rgba(203,166,247,.08);color:var(--accent)}
.row{display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid rgba(30,36,48,.6)}
.row .icon{width:14px}
.row .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .ms{width:76px;text-align:right}
.row .total{width:76px;text-align:right;color:var(--muted)}
.row .file{width:150px;text-align:right;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.status-done .icon{color:var(--done)}
.status-running .icon{color:var(--running)}
.status-waiting .icon{color:var(--waiting)}
.status-failed .icon{color:var(--failed)}
.pane{flex:1;padding:16px;overflow:auto}
.waterfall{position:relative;width:100%}
.box{position:absolute;height:20px;border-radius:4px;overflow:hidden;white-space:nowrap;background:#1e2430;border:1px solid #2a3242;padding:0 6px;font-size:11px}
.box.status-done{background:rgba(166,227,161,.25);border-color:var(--done)}
.box.status-running{background:rgba(137,180,250,.25);border-color:var(--running)}
.box.status-waiting{background:rgba(147,153,178,.25);border-color:var(--waiting)}
.box.status-failed{background:rgba(243,139,168,.25);border-color:var(--failed)}
`;

const REPORT_JS = `
(function(){
  var trace = window.__SAARTHI_TRACE__ || { traceId: "?", totalMs: 0, spans: [] };
  var spans = trace.spans || [];
  var total = trace.totalMs || 1;
  var root = document.getElementById("root");
  function esc(v){ return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  var byId = {}; spans.forEach(function(s){ byId[s.id]=s; });
  function depth(s){ var d=0,p=s.parentId,seen={}; while(p&&!seen[p]){seen[p]=1;var par=byId[p];if(!par)break;d++;p=par.parentId;} return d; }
  var best=null; spans.forEach(function(s){ var self=s.selfMs||0; if(!best||self>(best.selfMs||0)) best=s; });
  var banner="";
  if(best&&(best.selfMs||0)>0){ var pct=total>0?Math.round((best.selfMs/total)*100):0;
    banner='<div class="bottleneck" data-testid="report-bottleneck"><strong>'+esc(best.name)+'</strong> is the bottleneck — '+pct+'% of this request</div>'; }
  var icons={done:"✓",running:"▶",waiting:"…",failed:"✕"};
  var rows=spans.slice().sort(function(a,b){ return (b.selfMs==null?-1:b.selfMs)-(a.selfMs==null?-1:a.selfMs); });
  var rowsHtml=rows.map(function(s){
    var self=s.selfMs==null?"…":s.selfMs+"ms"; var t=(s.end==null?0:(s.end-s.start));
    return '<div class="row status-'+s.status+'" data-testid="report-row" data-span-id="'+esc(s.id)+'">'+
      '<span class="icon">'+(icons[s.status]||"•")+'</span><span class="name">'+esc(s.name)+'</span>'+
      '<span class="ms">'+esc(self)+'</span><span class="total">'+t.toFixed(2)+'ms</span>'+
      '<span class="file">'+esc(s.file)+':'+s.line+'</span></div>';
  }).join("");
  var boxes=spans.map(function(s){
    var end=s.end==null?total:s.end; var w=Math.max(end-s.start,0);
    return '<div class="box status-'+s.status+'" data-testid="report-box" data-span-id="'+esc(s.id)+'" style="left:'+((s.start/total)*100)+'%;width:'+Math.max((w/total)*100,0.4)+'%;top:'+(depth(s)*26)+'px" title="'+esc(s.name)+'">'+esc(s.name)+'</div>';
  }).join("");
  var maxDepth=spans.reduce(function(m,s){return Math.max(m,depth(s));},0);
  root.innerHTML='<header class="header"><strong>Saarthi</strong><span class="muted">'+esc(trace.traceId)+'</span><span class="total">'+total.toFixed(1)+' ms</span></header>'+
    '<div class="body"><aside class="sidebar">'+banner+'<div class="rows">'+rowsHtml+'</div></aside>'+
    '<main class="pane"><div class="waterfall" style="height:'+((maxDepth+1)*26+8)+'px">'+boxes+'</div></main></div>';
})();
`;
