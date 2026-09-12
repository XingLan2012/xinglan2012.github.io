/* The build replaces both tokens; this file is never registered in development. */
const VERSION = "a91fa427ab341f73";
const FILES = ["archives/XINGLAN-OS-X-001.txt","archives/XINGLAN-OS-X-002.txt","archives/XINGLAN-OS-X-003.txt","archives/XINGLAN-OS-X-004.txt","archives/XINGLAN-OS-X-005.txt","archives/XINGLAN-OS-X-006.txt","archives/XINGLAN-OS-X-007.txt","archives/XINGLAN-OS-X-008.txt","archives/XINGLAN-OS-X-009.txt","archives/XINGLAN-OS-X-010.txt","archives/XINGLAN-OS-X-011.txt","archives/XINGLAN-OS-X-012.txt","archives/XINGLAN-OS-X-013.txt","archives/XINGLAN-OS-X-014.txt","archives/XINGLAN-OS-X-015.txt","archives/XINGLAN-OS-X-016.txt","archives/XINGLAN-OS-X-017.txt","archives/XINGLAN-OS-X-018.txt","archives/XINGLAN-OS-X-019.txt","archives/XINGLAN-OS-X-020.txt","archives/XINGLAN-OS-X-021.txt","archives/XINGLAN-OS-X-022.txt","archives/XINGLAN-OS-X-023.txt","archives/XINGLAN-OS-X-024.txt","archives/XINGLAN-OS-X-025.txt","archives/XINGLAN-OS-X-026.txt","archives/XINGLAN-OS-X-027.txt","archives/XINGLAN-OS-X-028.txt","archives/XINGLAN-OS-X-029.txt","archives/XINGLAN-OS-X-030.txt","archives/XINGLAN-OS-X-031.txt","archives/XINGLAN-OS-X-032.txt","archives/XINGLAN-OS-X-033.txt","archives/XINGLAN-OS-X-034.txt","archives/XINGLAN-OS-X-035.txt","archives/XINGLAN-OS-X-036.txt","archives/XINGLAN-OS-X-037.txt","archives/XINGLAN-OS-X-038.txt","archives/XINGLAN-OS-X-039.txt","archives/XINGLAN-OS-X-040.txt","assets/index-ApeUQTnf.js","assets/index-DLhjq4G7.css","favicon.svg","icons/app-icon.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest"];
const PREFIX = `rhine-lab:${new URL(self.registration.scope).pathname}:`;
const CACHE = PREFIX + VERSION;
const urls = FILES.map(path => new URL(path, self.registration.scope).href);
const allowed = new Set(urls);
const index = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Conditional validation also catches model/font changes at stable URLs.
      await cache.addAll(urls.map(url => new Request(url, { cache: "no-cache" })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys())
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "RHINE_APPLY_UPDATE") event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  url.search = "";
  url.hash = "";
  const navigation = event.request.mode === "navigate" &&
    (url.href === self.registration.scope || url.href === index);
  const key = navigation ? index : url.href;
  if (!allowed.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // HTML, hashed bundles and stable model URLs come from the same release.
    // A new release stays waiting until the user chooses to restart or exits.
    const cached = await cache.match(key);
    return cached ?? fetch(event.request);
  })());
});
