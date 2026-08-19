/**
 * Cloudflare Turnstile solver for server-side flows (e.g. APLMate).
 * Set CAPTCHA_API_KEY (or TURNSTILE_API_KEY) and optionally CAPTCHA_PROVIDER=2captcha|capsolver.
 */

const DEFAULT_SITEKEY = "0x4AAAAAACd16sFwAoNHGZqs";
const DEFAULT_PAGEURL = "https://aplmate.com/";

const PROVIDER = (process.env.CAPTCHA_PROVIDER || "2captcha").toLowerCase();
const API_KEY = (process.env.CAPTCHA_API_KEY || process.env.TURNSTILE_API_KEY || "").trim();
const SITEKEY = (process.env.APLMATE_TURNSTILE_SITEKEY || DEFAULT_SITEKEY).trim();
const PAGEURL = (process.env.APLMATE_TURNSTILE_PAGEURL || DEFAULT_PAGEURL).trim();

const POLL_MS = 3000;
const MAX_WAIT_MS = 120000;

function missingKeyError() {
  return new Error(
    "Brak CAPTCHA_API_KEY — APLMate wymaga tokenu Cloudflare Turnstile. " +
      "Ustaw CAPTCHA_API_KEY (2captcha lub capsolver) w .env na NAS."
  );
}

async function poll2Captcha(taskId) {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const url = new URL("https://2captcha.com/res.php");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("action", "get");
    url.searchParams.set("id", taskId);
    url.searchParams.set("json", "1");
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    if (data.status === 1 && data.request) return data.request;
    if (data.request !== "CAPCHA_NOT_READY") {
      throw new Error(`2captcha: ${data.request || "nieznany błąd"}`);
    }
  }
  throw new Error("2captcha: timeout oczekiwania na token Turnstile.");
}

async function solve2Captcha({ sitekey, pageurl }) {
  const body = new URLSearchParams({
    key: API_KEY,
    method: "turnstile",
    sitekey,
    pageurl,
    json: "1",
  });
  const res = await fetch("https://2captcha.com/in.php", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  if (data.status !== 1 || !data.request) {
    throw new Error(`2captcha in.php: ${data.request || "błąd tworzenia zadania"}`);
  }
  return poll2Captcha(String(data.request));
}

async function solveCapSolver({ sitekey, pageurl }) {
  const createRes = await fetch("https://api.capsolver.com/createTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientKey: API_KEY,
      task: {
        type: "AntiTurnstileTaskProxyLess",
        websiteURL: pageurl,
        websiteKey: sitekey,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const created = await createRes.json();
  if (created.errorId || !created.taskId) {
    throw new Error(`CapSolver createTask: ${created.errorDescription || "błąd tworzenia zadania"}`);
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const pollRes = await fetch("https://api.capsolver.com/getTaskResult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: API_KEY, taskId: created.taskId }),
      signal: AbortSignal.timeout(30000),
    });
    const polled = await pollRes.json();
    if (polled.status === "ready" && polled.solution?.token) {
      return polled.solution.token;
    }
    if (polled.status === "failed") {
      throw new Error(`CapSolver: ${polled.errorDescription || "rozwiązanie nie powiodło się"}`);
    }
  }
  throw new Error("CapSolver: timeout oczekiwania na token Turnstile.");
}

export async function solveTurnstileToken({
  sitekey = SITEKEY,
  pageurl = PAGEURL,
} = {}) {
  if (!API_KEY) throw missingKeyError();

  if (PROVIDER === "capsolver") {
    return solveCapSolver({ sitekey, pageurl });
  }
  if (PROVIDER === "2captcha" || PROVIDER === "twocaptcha") {
    return solve2Captcha({ sitekey, pageurl });
  }
  throw new Error(`Nieobsługiwany CAPTCHA_PROVIDER: ${PROVIDER} (użyj 2captcha lub capsolver).`);
}

export function turnstileSolverConfigured() {
  return Boolean(API_KEY);
}
