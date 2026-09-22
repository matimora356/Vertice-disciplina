const CACHE="vertice-v4-login-fix-2026-09-22";
const ASSETS=["./","./index.html","./styles.css","./app.js?v=4-login-fix","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("vertice-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 const url=new URL(e.request.url);
 // Firebase and other remote services must never receive cached HTML.
 if(e.request.method!=="GET"||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(e.request);
   if(response.ok)await cache.put(e.request,response.clone());
   return response;
  }catch(error){
   const cached=await cache.match(e.request);
   if(cached)return cached;
   if(e.request.mode==="navigate"){
    const page=await cache.match("./index.html");
    if(page)return page;
   }
   throw error;
  }
 })());
});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=e.notification.data?.url||"./";e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const c of list){if("focus"in c)return c.focus()}return clients.openWindow(url)}))});
