// J.S. — servidor de avisos (Web Push) para lembretes chegarem com o app fechado.
// Supabase Edge Function. Mesma base do push do Meu Financeiro IA: biblioteca
// web-push, chaves VAPID geradas e guardadas no banco, inscrições por aparelho.
//
// Rotas (todas em /functions/v1/js-push/...):
//   GET  public-key   -> chave pública VAPID para o navegador se inscrever
//   POST sync         -> aparelho envia inscrição + lembretes dos próximos dias
//   POST unsubscribe  -> aparelho desliga e apaga seus dados do servidor
//   POST test         -> manda uma notificação de teste para o aparelho
//   POST cron         -> chamado a cada minuto pelo pg_cron: envia o que venceu
//
// Registro rápido de treino (atalho do iPhone: Tocar Atrás -> Atalhos -> página rapido.html):
//   POST quick-context -> o app liga o atalho e manda o exercício atual (série, carga, repetições)
//   GET  quick?d=&k=   -> a página do atalho lê o contexto para abrir preenchida
//   POST quick-add     -> a página do atalho salva uma série (peso, repetições, série, exercício)
//   POST quick-pull    -> o app busca as séries que chegaram pelo atalho
//   POST quick-ack     -> o app confirma que importou (as séries são apagadas)
//   POST quick-off     -> o app desliga o atalho (apaga tudo deste aparelho)
//
// Sem login: cada aparelho tem um id e um segredo gerados no próprio celular.
// O servidor guarda só o hash do segredo.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("JS_CRON_SECRET") ?? "";
const SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:js-app@users.noreply.github.com";

const MAX_REMINDERS = 3000;         // por aparelho
const WINDOW_DAYS = 732;            // aceita lembretes até ~2 anos à frente
const CHUNK = 500;                  // linhas por gravação
const CHECK_MARGIN_MS = 15 * 60000; // conferência de contagem ignora os próximos 15 min (relógios diferentes)
const CATCHUP_MS = 2 * 3600 * 1000; // lembrete atrasado mais de 2 h não é mais enviado
const ROUTES = ["inicio", "rotina", "treino", "sessao", "autocuidado", "alimentacao", "financeiro", "corpo", "graficos", "mais", "agenda", "config"];
const QUICK_MAX_PER_DAY = 300;      // séries por aparelho por dia (evita abuso do link)
// Só manda para serviços de push conhecidos (evita usar o servidor para chamar outros endereços).
const PUSH_HOSTS = [".googleapis.com", ".mozilla.com", ".mozaws.net", ".push.apple.com", ".notify.windows.com"];

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info, x-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => u.hostname.endsWith(h) || u.hostname === h.slice(1));
  } catch {
    return false;
  }
}

/* ---------------- Chaves VAPID (geradas uma vez e guardadas, como no Financeiro) ---------------- */

let vapidCache: { publicKey: string; privateKey: string } | null = null;
async function vapid() {
  if (vapidCache) return vapidCache;
  const envPub = Deno.env.get("VAPID_PUBLIC_KEY"), envPriv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (envPub && envPriv) return (vapidCache = { publicKey: envPub, privateKey: envPriv });
  const read = () => db.from("js_vapid_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
  let { data } = await read();
  if (!data) {
    const g = webpush.generateVAPIDKeys();
    // ignoreDuplicates: se duas chamadas gerarem ao mesmo tempo, vale a primeira gravada.
    await db.from("js_vapid_keys").upsert({ id: 1, public_key: g.publicKey, private_key: g.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    ({ data } = await read());
  }
  if (!data) throw new Error("vapid-indisponivel");
  return (vapidCache = { publicKey: data.public_key, privateKey: data.private_key });
}

async function send(sub: { endpoint: string; p256dh: string; auth: string }, payload: Record<string, unknown>) {
  const keys = await vapid();
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { TTL: 3600, urgency: "high" },
  );
}

/* ---------------- Aparelho ---------------- */

type Body = Record<string, any>;

// Confere o segredo do aparelho. Aparelho novo ainda não tem registro (allowNew).
async function device(body: Body, allowNew: boolean) {
  if (!isUuid(body.deviceId) || typeof body.token !== "string" || body.token.length < 32 || body.token.length > 200) {
    return { error: json({ error: "invalid-device" }, 400) };
  }
  const hash = await sha256(body.token);
  const { data } = await db.from("js_devices").select("id, token_hash, endpoint, p256dh, auth").eq("id", body.deviceId).maybeSingle();
  if (data && data.token_hash !== hash) return { error: json({ error: "forbidden" }, 403) };
  if (!data && !allowNew) return { error: json({ error: "unknown-device" }, 404) };
  return { row: data, hash };
}

function toRows(deviceId: string, list: unknown) {
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const r of (Array.isArray(list) ? list.slice(0, MAX_REMINDERS) : []) as any[]) {
    const key = str(r?.key, 200), title = str(r?.title, 160);
    const at = Date.parse(r?.at);
    if (!key || !title || !Number.isFinite(at) || seen.has(key)) continue;
    if (at < now - 5 * 60000 || at > now + WINDOW_DAYS * 86400000) continue;
    seen.add(key);
    rows.push({
      device_id: deviceId, key, title, at: new Date(at).toISOString(),
      body: str(r?.body, 240) || null, route: ROUTES.includes(r?.route) ? r.route : "inicio",
    });
  }
  return rows;
}

async function inChunks<T>(items: T[], size: number, fn: (part: T[]) => Promise<{ error: unknown }>) {
  for (let i = 0; i < items.length; i += size) {
    const { error } = await fn(items.slice(i, i + size));
    if (error) return error;
  }
  return null;
}

// Quantos lembretes pendentes o aparelho tem depois de "agora + margem" (o app confere com a lista dele).
async function pendingAfterMargin(deviceId: string) {
  const { count } = await db.from("js_reminders").select("key", { count: "exact", head: true })
    .eq("device_id", deviceId).is("sent_at", null).gt("at", new Date(Date.now() + CHECK_MARGIN_MS).toISOString());
  return count ?? 0;
}

// mode "full": substitui todos os pendentes pela lista enviada.
// mode "diff": aplica só as mudanças (upsert = novos/alterados, remove = chaves que saíram).
async function handleSync(body: Body, req: Request) {
  const d = await device(body, true);
  if (d.error) return d.error;
  const sub = body.subscription;
  if (!sub || !validEndpoint(sub.endpoint) || typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string") {
    return json({ error: "invalid-subscription" }, 400);
  }
  const diff = body.mode === "diff";
  const rows = toRows(body.deviceId, diff ? body.upsert : body.reminders);

  // O mesmo navegador só pode estar em um aparelho (ex.: dados apagados e app reativado).
  await db.from("js_devices").delete().eq("endpoint", sub.endpoint).neq("id", body.deviceId);
  const { error: upErr } = await db.from("js_devices").upsert({
    id: body.deviceId, token_hash: d.hash, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    user_agent: str(req.headers.get("user-agent"), 300) || null, tz: str(body.tz, 60) || null,
    updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (upErr) { console.error("sync/device", upErr); return json({ error: "save-failed" }, 500); }

  if (diff) {
    // Remove os que saíram (só pendentes) e grava os novos/alterados. Os já enviados não mudam.
    const remove = (Array.isArray(body.remove) ? body.remove : []).map((k: unknown) => str(k, 200)).filter(Boolean).slice(0, MAX_REMINDERS);
    const delErr = await inChunks(remove, 100, (part) =>
      db.from("js_reminders").delete().eq("device_id", body.deviceId).is("sent_at", null).in("key", part));
    if (delErr) { console.error("sync/remove", delErr); return json({ error: "save-failed" }, 500); }
    const saveErr = await inChunks(rows, CHUNK, (part) => db.from("js_reminders").upsert(part, { onConflict: "device_id,key" }));
    if (saveErr) { console.error("sync/upsert", saveErr); return json({ error: "save-failed" }, 500); }
  } else {
    // Substitui os lembretes pendentes; os já enviados ficam (para não repetir).
    const { error: delErr } = await db.from("js_reminders").delete().eq("device_id", body.deviceId).is("sent_at", null);
    if (delErr) { console.error("sync/delete", delErr); return json({ error: "save-failed" }, 500); }
    const insErr = await inChunks(rows, CHUNK, (part) =>
      db.from("js_reminders").upsert(part, { onConflict: "device_id,key", ignoreDuplicates: true }));
    if (insErr) { console.error("sync/insert", insErr); return json({ error: "save-failed" }, 500); }
  }
  return json({ ok: true, count: rows.length, pending: await pendingAfterMargin(body.deviceId) });
}

async function handleUnsubscribe(body: Body) {
  const d = await device(body, true);
  if (d.error) return d.error;
  if (d.row) await db.from("js_devices").delete().eq("id", body.deviceId); // apaga também os lembretes (cascade)
  return json({ ok: true });
}

async function handleTest(body: Body) {
  const d = await device(body, false);
  if (d.error) return d.error;
  try {
    await send(d.row!, { title: "Teste do J.S. 🌷", body: "Os avisos com o app fechado estão funcionando.", tag: "teste-servidor", route: "config" });
    return json({ ok: true });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await db.from("js_devices").delete().eq("id", body.deviceId);
    console.error("test", e);
    return json({ error: "send-failed", status }, 502);
  }
}

/* ---------------- Envio a cada minuto ---------------- */

async function handleCron(req: Request) {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);
  const now = new Date();
  const { data: due, error } = await db.from("js_reminders")
    .select("device_id, key, title, body, route, js_devices(endpoint, p256dh, auth)")
    .is("sent_at", null)
    .lte("at", now.toISOString())
    .gte("at", new Date(now.getTime() - CATCHUP_MS).toISOString())
    .order("at")
    .limit(300);
  if (error) { console.error("cron/select", error); return json({ error: "select-failed" }, 500); }

  let sent = 0, failed = 0;
  const gone = new Set<string>();
  await Promise.all((due ?? []).map(async (r: any) => {
    const dev = r.js_devices;
    if (!dev || gone.has(r.device_id)) return;
    try {
      await send(dev, { title: r.title, body: r.body ?? "", tag: r.key, route: r.route });
      sent++;
      await db.from("js_reminders").update({ sent_at: new Date().toISOString() }).eq("device_id", r.device_id).eq("key", r.key);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.add(r.device_id); // inscrição expirou: o aparelho precisa reativar
      else { failed++; console.error("cron/send", status, e); }
    }
  }));
  for (const id of gone) await db.from("js_devices").delete().eq("id", id);

  // Limpeza: lembretes com mais de 3 dias.
  await db.from("js_reminders").delete().lt("at", new Date(now.getTime() - 3 * 86400000).toISOString());
  return json({ ok: true, due: due?.length ?? 0, sent, failed, removedDevices: gone.size });
}

/* ---------------- Registro rápido (atalho do iPhone) ---------------- */

type QuickBody = { deviceId?: unknown; token?: unknown; key?: unknown; context?: unknown; ids?: unknown;
  d?: unknown; k?: unknown; peso?: unknown; reps?: unknown; serie?: unknown; ex?: unknown; exName?: unknown };

const num = (v: unknown) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : NaN; };

function cleanContext(c: any) {
  const o = c && typeof c === "object" ? c : {};
  const opcoes = Array.isArray(o.opcoes) ? o.opcoes.slice(0, 40).map((x: any) => ({ id: str(x?.id, 60), nome: str(x?.nome, 80) })).filter((x: any) => x.id && x.nome) : [];
  const n = (v: unknown, max: number) => { const x = num(v); return Number.isFinite(x) && x >= 0 && x <= max ? x : null; };
  return {
    ativo: o.ativo === true, treino: str(o.treino, 60), exercicio: str(o.exercicio, 80), exercicioId: str(o.exercicioId, 60),
    serie: n(o.serie, 50), series: n(o.series, 50), peso: n(o.peso, 999), reps: n(o.reps, 999), passo: n(o.passo, 20), opcoes,
    atualizado: new Date().toISOString(),
  };
}

// App: autenticado pelo segredo do aparelho (como no push).
async function quickDevice(body: QuickBody) {
  if (!isUuid(body.deviceId) || typeof body.token !== "string" || body.token.length < 32 || body.token.length > 200) return { error: json({ error: "invalid-device" }, 400) };
  const hash = await sha256(body.token);
  const { data } = await db.from("js_quick_devices").select("id, token_hash, key_hash, context").eq("id", body.deviceId).maybeSingle();
  if (data && data.token_hash !== hash) return { error: json({ error: "forbidden" }, 403) };
  return { row: data, hash };
}

// Página do atalho: autenticada pela chave do link.
async function quickByKey(d: unknown, k: unknown) {
  if (!isUuid(d) || typeof k !== "string" || k.length < 24 || k.length > 200) return { error: json({ error: "link-invalido" }, 400) };
  const { data } = await db.from("js_quick_devices").select("id, key_hash, context").eq("id", d).maybeSingle();
  if (!data || data.key_hash !== await sha256(k)) return { error: json({ error: "link-invalido" }, 403) };
  return { row: data };
}

async function handleQuickContext(body: QuickBody) {
  const q = await quickDevice(body);
  if (q.error) return q.error;
  const ctx = cleanContext(body.context);
  if (!q.row) {
    if (typeof body.key !== "string" || body.key.length < 24 || body.key.length > 200) return json({ error: "invalid-key" }, 400);
    const { error } = await db.from("js_quick_devices").insert({ id: body.deviceId, token_hash: q.hash, key_hash: await sha256(body.key), context: ctx });
    if (error) { console.error("quick/insert", error); return json({ error: "save-failed" }, 500); }
  } else {
    const upd: Record<string, unknown> = { context: ctx, updated_at: new Date().toISOString() };
    if (typeof body.key === "string" && body.key.length >= 24 && body.key.length <= 200) upd.key_hash = await sha256(body.key);
    const { error } = await db.from("js_quick_devices").update(upd).eq("id", body.deviceId);
    if (error) { console.error("quick/update", error); return json({ error: "save-failed" }, 500); }
  }
  const { count } = await db.from("js_quick_sets").select("id", { count: "exact", head: true }).eq("device_id", body.deviceId);
  return json({ ok: true, pending: count ?? 0 });
}

async function handleQuickGet(url: URL) {
  const q = await quickByKey(url.searchParams.get("d"), url.searchParams.get("k"));
  if (q.error) return q.error;
  const { data: last } = await db.from("js_quick_sets").select("created_at, exercise_name, load, reps, serie").eq("device_id", q.row!.id).order("id", { ascending: false }).limit(5);
  return json({ ok: true, contexto: q.row!.context ?? {}, recentes: last ?? [] });
}

async function handleQuickAdd(body: QuickBody) {
  const q = await quickByKey(body.d, body.k);
  if (q.error) return q.error;
  const peso = num(body.peso), reps = num(body.reps), serie = body.serie == null || body.serie === "" ? null : num(body.serie);
  if (!(peso >= 0 && peso <= 999)) return json({ error: "peso-invalido" }, 400);
  if (!(reps >= 0 && reps <= 999)) return json({ error: "reps-invalidas" }, 400);
  if (serie !== null && !(serie >= 1 && serie <= 50)) return json({ error: "serie-invalida" }, 400);
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await db.from("js_quick_sets").select("id", { count: "exact", head: true }).eq("device_id", q.row!.id).gte("created_at", since);
  if ((count ?? 0) >= QUICK_MAX_PER_DAY) return json({ error: "limite-diario" }, 429);
  const ctx: any = q.row!.context ?? {};
  const exId = str(body.ex, 60) || ctx.exercicioId || null;
  const exName = str(body.exName, 80) || (exId && exId === ctx.exercicioId ? ctx.exercicio : null) ||
    (Array.isArray(ctx.opcoes) ? (ctx.opcoes.find((o: any) => o.id === exId) || {}).nome : null) || ctx.exercicio || null;
  const row = { device_id: q.row!.id, exercise_id: exId, exercise_name: exName, load: Math.round(peso * 10) / 10, reps: Math.round(reps), serie: serie === null ? null : Math.round(serie) };
  const { error } = await db.from("js_quick_sets").insert(row);
  if (error) { console.error("quick/add", error); return json({ error: "save-failed" }, 500); }
  // Próxima abertura da página já vem com a série seguinte e a carga usada.
  const same = !exId || exId === ctx.exercicioId;
  const next = { ...ctx, peso: row.load, reps: row.reps, exercicioId: exId, exercicio: exName, serie: (row.serie ?? (same ? Number(ctx.serie) || 1 : 1)) + 1, atualizado: new Date().toISOString() };
  await db.from("js_quick_devices").update({ context: next }).eq("id", q.row!.id);
  return json({ ok: true, salvo: row, mensagem: "Série " + (row.serie ?? ((same ? Number(ctx.serie) || 1 : 1))) + " salva: " + String(row.load).replace(".", ",") + " kg × " + row.reps });
}

async function handleQuickPull(body: QuickBody) {
  const q = await quickDevice(body);
  if (q.error) return q.error;
  if (!q.row) return json({ ok: true, sets: [] });
  const { data, error } = await db.from("js_quick_sets").select("id, created_at, exercise_id, exercise_name, load, reps, serie").eq("device_id", body.deviceId).order("id").limit(200);
  if (error) { console.error("quick/pull", error); return json({ error: "select-failed" }, 500); }
  return json({ ok: true, sets: data ?? [] });
}

async function handleQuickAck(body: QuickBody) {
  const q = await quickDevice(body);
  if (q.error) return q.error;
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 500) : [];
  if (q.row && ids.length) await db.from("js_quick_sets").delete().eq("device_id", body.deviceId).in("id", ids);
  return json({ ok: true });
}

async function handleQuickOff(body: QuickBody) {
  const q = await quickDevice(body);
  if (q.error) return q.error;
  if (q.row) await db.from("js_quick_devices").delete().eq("id", body.deviceId);
  return json({ ok: true });
}

/* ---------------- Roteamento ---------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const route = url.pathname.split("/").filter(Boolean).pop();
  try {
    if (route === "public-key" && req.method === "GET") return json({ publicKey: (await vapid()).publicKey });
    if (route === "quick" && req.method === "GET") return await handleQuickGet(url);
    if (req.method !== "POST") return json({ error: "not-found" }, 404);
    if (route === "cron") return await handleCron(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return json({ error: "invalid-json" }, 400);
    if (route === "sync") return await handleSync(body, req);
    if (route === "unsubscribe") return await handleUnsubscribe(body);
    if (route === "test") return await handleTest(body);
    const qb = body as unknown as QuickBody;
    if (route === "quick-context") return await handleQuickContext(qb);
    if (route === "quick-add") return await handleQuickAdd(qb);
    if (route === "quick-pull") return await handleQuickPull(qb);
    if (route === "quick-ack") return await handleQuickAck(qb);
    if (route === "quick-off") return await handleQuickOff(qb);
    return json({ error: "not-found" }, 404);
  } catch (e) {
    console.error("js-push", e);
    return json({ error: "server-error" }, 500);
  }
});
