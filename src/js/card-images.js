// One decoded image/promise per content-hashed URL, shared by cards and shares.
const images=new Map();
const cacheName='orca-card-images-v1:'+new URL('.',import.meta.url).pathname;
let cachePromise,trimScheduled=false;
const boundImages=new WeakMap();
export function primeImage(src,image){if(image?.naturalWidth)images.set(src,{image,promise:Promise.resolve(image),failed:false});}
function trimCacheLater(cache){
  if(trimScheduled)return;trimScheduled=true;
  const trim=async()=>{try{const keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-160)).map(key=>cache.delete(key)))}catch{}};
  if(window.requestIdleCallback)requestIdleCallback(trim,{timeout:5000});else setTimeout(trim,2000);
}
function imageCache(){
  if(!cachePromise)cachePromise=(async()=>{
    try{return await caches.open(cacheName);}catch{return null;}
  })();
  return cachePromise;
}
async function fetchImage(src,retry){
  const url=new URL(src,document.baseURI).href;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  let objectURL;
  try{
    const cache=await imageCache();
    if(retry&&cache)await cache.delete(url).catch(()=>{});
    const cached=!retry&&cache?await cache.match(url).catch(()=>null):null;
    const response=cached||await fetch(url,{signal:controller.signal,cache:retry?'reload':'force-cache'});
    if(!response.ok)throw new Error('Image HTTP '+response.status);
    const blob=await response.blob();
    const img=new Image();
    objectURL=URL.createObjectURL(blob);img.src=objectURL;
    await img.decode();
    if(!img.naturalWidth)throw new Error('Empty image');
    if(cache&&!cached){
      // Storage failure must never prevent a successful draw. Limit old versions.
      cache.put(url,new Response(blob,{status:response.status,statusText:response.statusText,headers:response.headers})).then(()=>trimCacheLater(cache)).catch(()=>{});
    }
    return img;
  }catch(error){
    if(objectURL)URL.revokeObjectURL(objectURL);
    throw error;
  }finally{clearTimeout(timeout);}
}
export function whenLoaded(src,{retry=false}={}){
  if(!src)return Promise.resolve(null);
  const previous=images.get(src);
  if(previous&&!(retry&&previous.failed))return previous.promise;
  const entry={image:null,promise:null,failed:false};
  entry.promise=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
      try{entry.image=await fetchImage(src,attempt>0);return entry.image;}catch{}
    }
    entry.failed=true; // Preload/render share a failure; an explicit retry can recover.
    return null;
  })();
  images.set(src,entry);
  return entry.promise;
}
export function getLoadedImage(src){return images.get(src)?.image;}

export function hydrateCardImages(container){
  const pending=new Map();
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const load=pending.get(entry.target);
      pending.delete(entry.target);observer.unobserve(entry.target);load?.();
    }
  }):null;
  container.querySelectorAll('img[data-card-src]').forEach(img=>{
    const card=img.closest('.rcard');
    const status=card?.querySelector('.card-image-status');
    const retry=card?.querySelector('.image-retry');
    let active=null;
    const load=(retryLoad=false)=>{
      if(active&&!retryLoad)return active;
      active=(async()=>{
        if(retry)retry.hidden=true;
        if(status){status.hidden=false;status.textContent='牌面加载中…';}
        const loaded=await whenLoaded(img.dataset.cardSrc,{retry:retryLoad});
        if(!img.isConnected)return false;
        if(loaded){
          img.decoding='async';img.src=loaded.src;
          try{await img.decode();}catch{if(status)status.textContent='牌面暂时无法加载';if(retry)retry.hidden=false;return false;}
          if(!img.isConnected)return false;
          img.hidden=false;card?.classList.add('front-ready');if(status)status.hidden=true;return true;
        }
        if(status)status.textContent='牌面暂时无法加载';
        if(retry)retry.hidden=false;
        return false;
      })();
      return active;
    };
    card?.classList.remove('front-ready');boundImages.set(img,load);
    if(retry)retry.onclick=e=>{e.stopPropagation();load(true);};
    if(img.loading==='lazy'&&observer){
      pending.set(img,load);observer.observe(img);
    }else load();
  });
  return ()=>{observer?.disconnect();pending.clear();};
}

export function prepareCardFace(card){const img=card.querySelector('img[data-card-src]');return boundImages.get(img)?.()||Promise.resolve(false);}
