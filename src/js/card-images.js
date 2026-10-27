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
// Open storage during startup; the first selected card need not open it on demand.
imageCache();
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

// A selected card owns its actual DOM image from selection through the flip.
// Decoding a separate cached Image alone does not prepare a later DOM node.
function imageBinding(img){
  if(boundImages.has(img))return boundImages.get(img);
  const entry={state:'idle',promise:null,listeners:new Set(),load:null};
  const notify=()=>entry.listeners.forEach(fn=>fn(entry.state));
  entry.load=(retry=false)=>{
    if(entry.promise&&!retry)return entry.promise;
    // The observer has already chosen to load this image. Native lazy loading
    // must not defer decode again while the image is hidden for preparation.
    img.loading='eager';entry.state='pending';img.hidden=true;notify();
    entry.promise=(async()=>{
      const loaded=await whenLoaded(img.dataset.cardSrc,{retry});
      if(loaded){
        img.decoding='async';img.src=loaded.src;
        try{await img.decode();entry.state='ready';img.hidden=false;notify();return true;}catch{}
      }
      entry.state='failed';notify();return false;
    })();
    return entry.promise;
  };
  boundImages.set(img,entry);return entry;
}
export function prepareCardImage(src){
  const img=new Image();img.dataset.cardSrc=src;img.hidden=true;img.draggable=false;
  imageBinding(img).load(true);return img;
}
export function hydrateCardImages(container,{prepared=[]}={}){
  const pending=new Map(),unsubscribers=[];
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const load=pending.get(entry.target);
      pending.delete(entry.target);observer.unobserve(entry.target);load?.();
    }
  }):null;
  container.querySelectorAll('img[data-card-src]').forEach((placeholder,index)=>{
    const img=prepared[index]||placeholder;
    if(img!==placeholder){
      for(const name of ['class','alt','draggable'])if(placeholder.hasAttribute(name))img.setAttribute(name,placeholder.getAttribute(name));
      placeholder.replaceWith(img);
    }
    const card=img.closest('.rcard'),status=card?.querySelector('.card-image-status'),retry=card?.querySelector('.image-retry');
    const entry=imageBinding(img),thumb=img.closest('.hd-thumb');
    let historyRetry;
    const paint=state=>{
      if(thumb){
        thumb.dataset.imageState=state;
        if(state==='failed'&&!historyRetry){
          historyRetry=document.createElement('button');historyRetry.type='button';historyRetry.className='hd-image-retry';historyRetry.textContent='重试';historyRetry.setAttribute('aria-label','重新加载牌面');
          historyRetry.onclick=e=>{e.stopPropagation();entry.load(true)};thumb.append(historyRetry);
        }
        if(historyRetry)historyRetry.hidden=state!=='failed';
      }
      card?.classList.toggle('front-ready',state==='ready');
      if(status){status.hidden=state==='ready';status.textContent=state==='failed'?'牌面暂时无法加载':'牌面加载中…';}
      if(retry)retry.hidden=state!=='failed';
    };
    entry.listeners.add(paint);unsubscribers.push(()=>entry.listeners.delete(paint));paint(entry.state);
    if(retry)retry.onclick=e=>{e.stopPropagation();entry.load(true);};
    if(img.loading==='lazy'&&observer&&entry.state==='idle'){
      img.hidden=true;const target=img.closest('.hd-thumb')||img;pending.set(target,()=>entry.load());observer.observe(target);
    }else entry.load();
  });
  return ()=>{observer?.disconnect();pending.clear();unsubscribers.forEach(fn=>fn());};
}
export function cardFaceReady(card){return boundImages.get(card.querySelector('img[data-card-src]'))?.state==='ready';}
export function prepareCardFace(card){const img=card.querySelector('img[data-card-src]');return boundImages.get(img)?.load()||Promise.resolve(false);}
