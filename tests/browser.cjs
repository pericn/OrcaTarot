/* Browser-level acceptance checks. The runner supplies an isolated browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function run(browser, url, output) {
  if (output) fs.mkdirSync(output, {recursive:true});
  const reports=[], failures=[], errors=[], limitations=[];
  const filter=process.env.ORCA_TEST_FILTER?new RegExp(process.env.ORCA_TEST_FILTER):null;
  async function test(name, fn) {
    if(filter&&!filter.test(name))return;
    try { await fn(); reports.push(name); console.log('PASS '+name); }
    catch(e) { failures.push({name,message:e.stack}); console.error('FAIL '+name+' — '+e.stack); }
  }
  async function reading(prefs={}) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(p=>{
      localStorage.setItem('lx-prefs',JSON.stringify({minor:false,rev:false,spread:'3',...p}));
      localStorage.setItem('lx-guide-done','1');
      localStorage.setItem('lx-icon-notice-v2','1');
    },prefs);
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url); await page.locator('.fcard').first().waitFor({state:'attached'});
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('#appLoading').waitFor({state:'hidden'});
    return {page,context};
  }
  async function pick(page,keys) {
    for (const key of keys) {
      // Choose a known shuffled card to exercise rules deterministically; no app state is exposed.
      const card=page.locator('#fanTrack .fcard[data-key="'+key+'"]');
      await card.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'center'}));
      await card.dispatchEvent('click');
      await page.waitForTimeout(510);
    }
    await page.locator('#reveal').waitFor({state:'visible'});
  }
  async function flip(page) {
    for(const card of await page.locator('#rvRow .rcard .flip').all()) await card.click();
    await page.waitForTimeout(650);
  }
  async function history(page) {return page.evaluate(()=>JSON.parse(localStorage.getItem('lx-history')||'[]'));}

  await test('78/22 card toggle, reverse preference, card fonts, light/dark contrast, full width fan', async()=>{
    const {page,context}=await reading({minor:true});
    assert.equal(await page.locator('.fcard').count(),78);
    await page.locator('#fanWrap').evaluate(el=>el.scrollLeft=el.scrollWidth);
    await page.locator('#spreadInd').click();
    await page.locator('#tMinor').uncheck();assert.equal(await page.locator('.fcard').count(),22);
    await page.waitForTimeout(100);
    const visible=await page.locator('.fcard').evaluateAll(els=>els.filter(el=>getComputedStyle(el).visibility==='visible').map(el=>{
      const r=el.getBoundingClientRect();return {x:r.x+r.width/2,transform:el.style.transform};
    }));
    assert.ok(visible.some(r=>r.x>0&&r.x<130));
    assert.ok(visible.some(r=>r.x>260&&r.x<390));
    assert.ok(visible.every(r=>r.transform),'Visible fan cards must all be positioned');
    await page.locator('#tRev').check();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lx-prefs')).rev),true);
    await page.locator('#spreadClose').click();
    for(const dark of [false,true]) {
      if(dark)await page.locator('#themeBtn').click();
      const result=await page.evaluate(()=>{
        const s=getComputedStyle(document.documentElement);
        const rgb=x=>x.trim().match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
        const lum=x=>rgb(x.replace('#','')).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);
        const bg=lum(s.getPropertyValue('--paper'));
        const contrast=x=>{const fg=lum(s.getPropertyValue(x));return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)};
        const r=document.getElementById('fanWrap').getBoundingClientRect();
        return {contrast:[contrast('--ink'),contrast('--ink-soft'),contrast('--indigo'),contrast('--madder')],fanWidth:r.width,viewport:innerWidth,font:document.fonts.check('16px OrcaWoodblock'),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.ok(result.contrast.every(c=>c>=4.5),JSON.stringify(result));
      assert.ok(Math.abs(result.fanWidth-result.viewport)<2);assert.equal(result.overflow,false);assert.equal(result.font,true);
    }
    await page.locator('#spreadInd').click();
    assert.equal(await page.locator('.sp-head').nth(0).innerText(),'');
    assert.equal(await page.locator('.sp-head').nth(1).innerText(),'');
    assert.equal(await page.locator('.sp-head').nth(2).innerText(),'');
    assert.equal((await page.locator('#bdayHead').innerText()).trim(),'生日牌阵');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#spreadOv').isVisible(),false);
    await context.close();
  });

  await test('fan accepts real pointer and keyboard input',async()=>{
    const {page,context}=await reading();
    const first=page.locator('.fcard').nth(11);
    await first.evaluate(el=>el.scrollIntoView({inline:'center',block:'nearest'}));
    await first.click({force:true});await page.waitForTimeout(510);
    assert.equal(await page.locator('.slot.done').count(),1);
    const next=page.locator('.fcard:not(.gone)').nth(10);
    await next.focus();await page.keyboard.press('Enter');await page.waitForTimeout(510);
    assert.equal(await page.locator('.slot.done').count(),2);
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'21');
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'0');
    await context.close();
  });

  await test('single, two and three card counts hide the fan; Marseille numbers and hidden card sum',async()=>{
    for(const [spread,keys] of [['1',['M13']],['2',['M00','M19']],['3',['M19','M17','M10']]]) {
      const {page,context}=await reading({spread});await pick(page,keys);
      assert.equal(await page.locator('#fanWrap').isVisible(),false);
      await flip(page);
      const names=await page.locator('#rvRow .rname').allTextContents();
      if(spread==='1')assert.deepEqual(names,['XIII']);
      if(spread==='2')assert.deepEqual(names,['愚者','XVIIII · 太阳']);
      if(spread==='3') {
        assert.equal(await page.locator('#rvHidden').isVisible(),true);
        assert.equal(await page.locator('#hCard .rname').innerText(),'X · 命运之轮'); // 19+17+10=46 -> 10
        await page.locator('#hCard .flip').click();
        assert.equal((await history(page))[0].cards.at(-1).hid,true);
      }
      assert.equal((await history(page)).length,1);
      await page.locator('#shareBtn').click();await page.locator('#shareOv').waitFor({state:'visible'});
      assert.ok((await page.locator('#shareImg').getAttribute('src')).startsWith('data:image/png;'));
      await context.close();
    }
  });

  await test('last wheel offers one extra; extra persists in the same history entry and share',async()=>{
    const {page,context}=await reading();
    await pick(page,['M01','M02','M10']);await flip(page);
    await page.locator('#hCard .flip').click();
    const original=(await history(page))[0];assert.equal(original.cards.length,4);
    await page.locator('.wheel-action').click();
    assert.equal(await page.locator('.wheel-action').count(),0);
    assert.equal(await page.locator('#shareBtn').isVisible(),false);
    await page.locator('#rvExtra .flip').click();await page.waitForTimeout(650);
    const records=await history(page);
    assert.equal(records.length,1);assert.equal(records[0].id,original.id);assert.equal(records[0].ts,original.ts);
    assert.equal(records[0].cards.length,5);
    assert.equal(records[0].cards.filter(c=>c.extra).length,1);
    assert.ok(!['M01','M02','M10'].includes(records[0].cards.find(c=>c.extra).key));
    await page.locator('#shareBtn').click();await page.locator('#shareOv').waitFor({state:'visible'});
    if(output)await page.locator('#shareImg').screenshot({path:path.join(output,'wheel-share.png')});
    await page.locator('#shareClose').click();
    if(output)await page.screenshot({path:path.join(output,'reading-extra.png'),fullPage:true});
    await context.close();
  });

  await test('first share completes when extra and hidden cards use the same uncached image',async()=>{
    const {page,context}=await reading();
    // Routing disables the HTTP cache, reproducing the concurrent image loads
    // seen on the protected staging host instead of relying on a warm cache.
    await context.route('**/*',route=>route.continue());
    await pick(page,['M01','M02','M10']);await flip(page);
    const remaining=await page.locator('.fcard').evaluateAll(els=>els.map(el=>el.dataset.key).filter(k=>!['M01','M02','M10'].includes(k)));
    await page.evaluate(v=>Math.random=()=>v,(remaining.indexOf('M13')+.1)/remaining.length);
    await page.locator('.wheel-action').click();
    assert.equal(await page.locator('#rvExtra .rname').innerText(),'XIII');
    assert.equal(await page.locator('#hCard .rname').innerText(),'XIII');
    await page.locator('#rvExtra .flip').click();await page.locator('#hCard .flip').click();
    await page.locator('#shareBtn').click();
    await page.locator('#shareOv').waitFor({state:'visible',timeout:10000});
    assert.ok((await page.locator('#shareImg').getAttribute('src')).startsWith('data:image/png;'));
    assert.equal((await history(page))[0].cards.filter(c=>c.key==='M13').length,2);
    await context.close();
  });

  await test('wheel elsewhere does not trigger; revealed hidden wheel triggers one extra',async()=>{
    const {page,context}=await reading();
    await pick(page,['M10','M01','M02']);await flip(page);
    assert.equal(await page.locator('.wheel-action').count(),0);
    await page.locator('#reShuffle').click();await pick(page,['M19','M17','M10']);
    // Last primary wheel does trigger, but only after it is turned over.
    await page.locator('#rvRow .rcard .flip').nth(0).click();
    assert.equal(await page.locator('.wheel-action').count(),0);
    await page.locator('#reShuffle').click();await pick(page,['M19','M20','M07']);await flip(page); // 46 -> hidden wheel
    assert.equal(await page.locator('#hCard .rname').innerText(),'X · 命运之轮');
    assert.equal(await page.locator('.wheel-action').count(),0);
    await page.locator('#hCard .flip').click();
    assert.equal(await page.locator('.wheel-action').count(),1);
    const original=(await history(page))[0];
    await page.locator('.wheel-action').click();
    await page.locator('#rvExtra .flip').click();
    const updated=(await history(page))[0];
    assert.equal(updated.id,original.id);assert.equal(updated.ts,original.ts);
    assert.ok(updated.cards[3].hid);assert.ok(updated.cards[4].extra);
    assert.equal(await page.locator('.wheel-action').count(),0);
    const layout=await page.evaluate(()=>{
      const h=document.getElementById('hCard').getBoundingClientRect();
      const e=document.querySelector('#rvExtra .rcard').getBoundingClientRect();
      return {hx:h.x,ex:e.x,hy:h.y,ey:e.y};
    });
    assert.ok(layout.hx<layout.ex);assert.equal(layout.hy,layout.ey);
    await context.close();
  });

  await test('reverse last wheel also offers extra, and minor cards keep their Roman numbers',async()=>{
    const {page,context}=await reading({minor:true,rev:true,spread:'2'});
    await page.evaluate(()=>{Math.random=()=>.1});
    await pick(page,['cup_09','M10']);await flip(page);
    assert.equal(await page.locator('#rvRow .rname').first().innerText(),'VIIII · 圣杯');
    assert.equal(await page.locator('#rvRow .rcard.rev').count(),2);
    assert.equal(await page.locator('#rvHidden').isVisible(),false);
    assert.equal(await page.locator('.wheel-action').count(),1);
    await context.close();
  });

  await test('birthday validity, five calculated cards in 3+2 layout, saved preferences',async()=>{
    const {page,context}=await reading();
    await page.clock.setFixedTime(new Date('2026-07-03T12:00:00Z'));
    await page.locator('#spreadInd').click();await page.locator('#bdayHead').click();
    for(const [id,value] of [['bY','1990'],['bM','2'],['bD','30']])await page.locator('#'+id).fill(value);
    await page.locator('#bStart').click();assert.equal(await page.locator('#bErr').isVisible(),true);
    await page.locator('#bM').fill('7');await page.locator('#bD').fill('3');await page.locator('#bStart').click();
    assert.equal(await page.locator('#rvRow .rcard').count(),5);
    assert.deepEqual(await page.locator('#rvRow .rposition').allTextContents(),['年','月','日','业力','流年']);
    await page.locator('#rvRow').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished)));
    const boxes=await page.locator('#rvRow .rcard').evaluateAll(els=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
    assert.equal(boxes[0].y,boxes[2].y);assert.equal(boxes[3].y,boxes[4].y);assert.ok(boxes[3].y>boxes[0].y);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lx-prefs')).spread),'bday');
    await flip(page);
    assert.deepEqual((await page.locator('#rvRow .rname').allTextContents()).slice(0,4),['XVIIII · 太阳','VII · 战车','III · 皇后','II · 女祭司']);
    const record=(await history(page))[0];
    assert.deepEqual(record.cards.map(c=>c.position),['年','月','日','业力','流年']);
    const digit=n=>{while(n>9)n=String(n).split('').reduce((sum,d)=>sum+Number(d),0);return n;};
    assert.equal(record.cards[4].key,'M'+String(digit(2026+7+3)).padStart(2,'0'));
    if(output)await page.screenshot({path:path.join(output,'birthday.png'),fullPage:true});
    await page.evaluate(()=>{window.drawn=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){window.drawn.push(t);return f.call(this,t,...a)}});
    await page.locator('#shareBtn').click();await page.locator('#shareOv').waitFor({state:'visible'});
    for(const position of ['年','月','日','业力','流年'])assert.ok((await page.evaluate(()=>window.drawn)).includes(position));
    await page.locator('#shareClose').click();
    const legacy={...record,cards:record.cards.map(({position,...card})=>card)};
    await page.evaluate(record=>localStorage.setItem('lx-history',JSON.stringify([record])),legacy);
    await page.locator('#historyBtn').click();
    assert.ok((await page.locator('.hd-kind').allTextContents()).includes('流年'));
    assert.equal(await page.locator('.hd-kind').evaluateAll(els=>els.some(el=>/[：:]/.test(el.textContent))),false);
    await page.evaluate(()=>window.drawn=[]);
    await page.locator('.hd-share').click();await page.locator('#shareOv').waitFor({state:'visible'});
    for(const position of ['年','月','日','业力','流年'])assert.ok((await page.evaluate(()=>window.drawn)).includes(position));
    assert.deepEqual(await history(page),[legacy]);
    await context.close();
  });

  await test('historical re-share keeps original date, hidden/extra tags, back returns to history',async()=>{
    const {page,context}=await reading();
    const rec={id:'test-old',ts:new Date(2020,1,3,10).getTime(),spread:'3',cards:[{key:'M19',cn:'XVIIII · 太阳',rev:true},{key:'M10',cn:'X · 命运之轮',hid:true},{key:'M02',cn:'II · 女祭司',extra:true}]};
    await page.evaluate(r=>localStorage.setItem('lx-history',JSON.stringify([r])),rec);
    await page.locator('#historyBtn').click();
    assert.ok((await page.locator('.hd-date').innerText()).includes('2020年2月3日'));
    assert.ok((await page.locator('.hd-names').innerText()).includes('隐藏'));
    assert.ok((await page.locator('.hd-names').innerText()).includes('追加'));
    const text=[];
    await page.evaluate(()=>{window.drawn=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){window.drawn.push(t);return f.call(this,t,...a)}});
    await page.locator('.hd-share').click();await page.locator('#shareOv').waitFor({state:'visible'});
    const drawn=await page.evaluate(()=>window.drawn);
    assert.ok(drawn.includes('2020 年 2 月 3 日'));assert.ok(drawn.includes('隐 藏 牌'));assert.ok(drawn.includes('追 加 牌'));assert.ok(drawn.includes('鲸灵匣'));
    await page.locator('#shareClose').click();assert.equal(await page.locator('#historyOv').isVisible(),true);
    await page.locator('#drawBtn').click();assert.equal(await page.locator('#draw').isVisible(),true);
    assert.deepEqual(await history(page),[rec]);
    await context.close();
  });

  await test('mobile and desktop layout, intrinsic motif ratio, front images lazy until selected',async()=>{
    for(const width of [320,390,768,1440]) {
      const {page,context}=await reading({minor:true});await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const ratio=await page.locator('.motif.sun').evaluate(img=>{const r=img.getBoundingClientRect();return {css:getComputedStyle(img).height,natural:img.naturalWidth/img.naturalHeight,rendered:img.offsetWidth/img.offsetHeight}});
      assert.ok(Math.abs(ratio.natural-ratio.rendered)<.01);
      const front=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\/M\d\d\./.test(e.name)));
      assert.equal(front.length,0);
      await page.waitForTimeout(750);
      if(output&&width===390)await page.screenshot({path:path.join(output,'home-light.png'),fullPage:true});
      if(output&&width===1440)await page.screenshot({path:path.join(output,'home-desktop.png'),fullPage:true});
      await page.locator('#themeBtn').click();
      if(output&&width===390)await page.screenshot({path:path.join(output,'home-dark.png'),fullPage:true});
      await context.close();
    }
  });

  await test('fixed navigation preserves reading; clear requires confirmation and danger color',async()=>{
    const {page,context}=await reading({spread:'1'});
    await pick(page,['M01']);await flip(page);
    const original=await history(page);
    const nav=await page.locator('.main-nav').boundingBox();
    await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
    const scrolled=await page.locator('.main-nav').boundingBox();
    assert.equal(nav.y,scrolled.y);assert.equal(nav.height,72);
    await page.locator('#historyBtn').click();
    assert.equal(await page.locator('#historyBtn').getAttribute('aria-current'),'page');
    await page.locator('#drawBtn').focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'historyBtn');
    assert.equal(await page.locator('#historyClear').evaluate(el=>getComputedStyle(el).color),await page.locator('.hd-del').evaluate(el=>getComputedStyle(el).color));
    page.once('dialog',dialog=>dialog.dismiss());
    await page.locator('#historyClear').click();assert.deepEqual(await history(page),original);
    await page.locator('#drawBtn').click();
    assert.equal(await page.locator('#reveal').isVisible(),true);
    await page.locator('#historyBtn').click();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#historyClear').click();assert.deepEqual(await history(page),[]);
    await page.locator('#drawBtn').click();
    assert.equal(await page.locator('#rvRow .rcard.flipped').count(),1);
    await context.close();
  });

  await test('history uses the bottom navigation and count follows the last record in the scroller',async()=>{
    const {page,context}=await reading();
    const records=Array.from({length:20},(_,i)=>({id:'test-'+i,ts:Date.now()-i*60000,spread:'1',cards:[{key:'M01',cn:'I · 魔术师',rev:false}]}));
    await page.evaluate(records=>localStorage.setItem('lx-history',JSON.stringify(records)),records);
    await page.locator('#historyBtn').click();
    assert.equal(await page.locator('#historyClose').count(),0);
    const before=await page.locator('#historyCount').boundingBox();
    const scroller=await page.locator('#historyScroll').boundingBox();
    assert.ok(before.y>scroller.y+scroller.height,'Count must follow all 20 records');
    await page.locator('#historyScroll').evaluate(el=>el.scrollTop=el.scrollHeight);
    const after=await page.locator('#historyCount').boundingBox();
    const last=await page.locator('.hd-item').last().boundingBox();
    assert.ok(after.y>=last.y+last.height);
    assert.ok(after.y+after.height<=scroller.y+scroller.height+1); // scrollHeight rounds to whole pixels
    const navTop=(await page.locator('.main-nav').boundingBox()).y;
    assert.ok(after.y+after.height<=navTop,'Last count clears the tab bar');
    assert.equal(await page.locator('#historyScroll').evaluate(el=>el.getBoundingClientRect().bottom),844,'History scrolls under the tab bar without a second blank strip');
    assert.equal(await page.locator('#historyCount').innerText(),'共 20 条 · 存于本机');
    await page.locator('#drawBtn').click();assert.equal(await page.locator('#draw').isVisible(),true);
    await context.close();
  });

  await test('fan and center card fit on the initial screen in short portrait and landscape viewports',async()=>{
    for(const [width,height] of [[320,568],[360,640],[390,667],[390,844],[430,932],[640,360],[844,390],[1440,900]]){
      const {page,context}=await reading({minor:true});
      await page.setViewportSize({width,height});await page.waitForTimeout(100);
      await page.evaluate(()=>scrollTo(0,0));
      const view=await page.evaluate(()=>{
        const fan=document.getElementById('fanWrap').getBoundingClientRect();
        const nav=document.querySelector('.main-nav').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.fcard')].filter(el=>getComputedStyle(el).visibility==='visible').map(el=>el.getBoundingClientRect());
        const center=cards.sort((a,b)=>Math.abs(a.x+a.width/2-(fan.x+fan.width/2))-Math.abs(b.x+b.width/2-(fan.x+fan.width/2)))[0];
        const slots=document.getElementById('slots').getBoundingClientRect();
        const prompt=document.getElementById('fanPrompt').getBoundingClientRect();
        return {slotFanGap:prompt.top-slots.bottom,fanTop:fan.top,fanBottom:fan.bottom,navTop:nav.top,cardTop:center.top,cardBottom:center.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      if(height>=500)assert.ok(view.slotFanGap>=6&&view.slotFanGap<=100,'Avoid a large empty block below slots: '+JSON.stringify({width,height,...view}));
      assert.ok(view.navTop-view.cardBottom<=50,'The fan should sit close to navigation: '+JSON.stringify({width,height,...view}));
      assert.ok(view.fanBottom<=view.navTop,JSON.stringify({width,height,...view}));
      assert.ok(view.cardTop>=view.fanTop&&view.cardBottom<=view.fanBottom,JSON.stringify(view));
      assert.equal(view.overflow,false);
      if(output&&width===320)await page.screenshot({path:path.join(output,'home-short.png')});
      if(output&&width===844)await page.screenshot({path:path.join(output,'home-landscape.png')});
      await context.close();
    }
  });

  await test('fronts reuse one request per round and survive reload with cached images or storage eviction',async()=>{
    const {page,context}=await reading();
    let requests=0;
    await context.route('**/M01.*.webp',route=>{requests++;return route.continue();});
    const card=page.locator('.fcard[data-key="M01"]');
    await card.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'center'}));
    await card.dispatchEvent('click');
    await page.waitForFunction(async()=>{
      for(const name of await caches.keys()){
        const cache=await caches.open(name);
        if((await cache.keys()).some(r=>/M01\./.test(r.url)))return true;
      }
      return false;
    });
    assert.equal(await page.locator('#draw').isVisible(),true);
    assert.equal(requests,1);
    await page.waitForTimeout(510);
    await pick(page,['M02','M03']);await flip(page);
    await page.locator('#reShuffle').click();await pick(page,['M01','M02','M03']);await flip(page);
    assert.equal(requests,1,'Same-round and next-round consumers reuse the image');
    await page.reload();
    await page.locator('#appLoading').waitFor({state:'hidden'});
    // CacheStorage may be evicted by the browser between documents (including
    // WebKit's test data store). Verify offline reuse when data remains, and
    // verify network recovery if the browser has discarded it.
    const retained=await page.evaluate(async()=>{const urls=[];for(const name of await caches.keys())urls.push(...(await(await caches.open(name)).keys()).map(r=>r.url));return ['M01.','M02.','M03.'].every(key=>urls.some(url=>url.includes(key)))});
    await context.unroute('**/M01.*.webp');
    if(retained)await context.route('**/assets/cards/M*.webp',route=>route.abort());
    else limitations.push(browser.browserType().name()+': CacheStorage was evicted between documents; network recovery tested instead of offline reuse.');
    await pick(page,['M01','M02','M03']);await flip(page);
    await page.waitForFunction(()=>[...document.querySelectorAll('#rvRow .front img')].every(i=>i.complete&&i.naturalWidth>0));
    await context.close();
  });

  await test('failed image retries automatically, offers manual recovery, and share has a fallback',async()=>{
    const {page,context}=await reading({spread:'1'});
    let requests=0,recover=false;
    await context.route('**/M04.*.webp',route=>{
      requests++;return recover?route.continue():route.fulfill({status:503,body:'temporarily unavailable'});
    });
    await pick(page,['M04']);await flip(page);
    await page.locator('.image-retry').waitFor({state:'visible'});
    assert.equal(requests,2);
    await page.evaluate(()=>{window.drawn=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){window.drawn.push(t);return f.call(this,t,...a)}});
    await page.locator('#shareBtn').click();await page.locator('#shareOv').waitFor({state:'visible'});
    assert.ok((await page.evaluate(()=>window.drawn)).includes('牌面暂不可用'));
    await page.locator('#shareClose').click();
    const original=await history(page);recover=true;
    await page.locator('.image-retry').click();
    await page.waitForFunction(()=>document.querySelector('#rvRow .front img').naturalWidth>0);
    assert.deepEqual(await history(page),original);
    await context.close();
  });

  await test('stalled image times out and retries; corrupted disk cache repairs itself',async()=>{
    const {page,context}=await reading({spread:'1'});
    await page.addInitScript(()=>{
      const fetchImage=window.fetch.bind(window),timer=window.setTimeout.bind(window);
      let shortened=false,stalled=false;window.stalledRequests=0;
      window.setTimeout=(fn,delay,...args)=>{
        if(delay===8000&&!shortened){shortened=true;delay=150;}
        return timer(fn,delay,...args);
      };
      window.fetch=(input,options)=>{
        if(String(input).includes('/M06.')&&!stalled){
          stalled=true;window.stalledRequests++;
          return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError')),{once:true}));
        }
        return fetchImage(input,options);
      };
    });
    await page.reload();await pick(page,['M06']);await flip(page);
    await page.waitForFunction(()=>document.querySelector('#rvRow .front img').naturalWidth>0);
    assert.equal(await page.evaluate(()=>window.stalledRequests),1);
    await page.locator('#reShuffle').click();
    await page.evaluate(async()=>{
      const {IMG}=await import('./js/images.js');
      const cache=await caches.open('orca-card-images-v1:'+new URL('js/',location.href).pathname);
      await cache.put(new URL(IMG.M08,location.href).href,new Response('corrupted image',{status:200}));
    });
    let requests=0;
    await context.route('**/M08.*.webp',route=>{requests++;return route.continue();});
    await pick(page,['M08']);await flip(page);
    await page.waitForFunction(()=>document.querySelector('#rvRow .front img').naturalWidth>0);
    assert.equal(requests,1,'Corrupt cached image should recover with one network retry');
    await context.close();
  });

  await test('cache storage denied still loads card fronts',async()=>{
    const {page,context}=await reading({spread:'1'});
    await page.addInitScript(()=>Object.defineProperty(window,'caches',{value:{open:()=>Promise.reject(new Error('denied'))}}));
    await page.reload();await pick(page,['M05']);await flip(page);
    await page.waitForFunction(()=>document.querySelector('#rvRow .front img').naturalWidth>0);
    await context.close();
  });

  await test('iOS guide: force open, three images, close persists, triple brand opens',async()=>{
    const {page,context}=await reading();
    await page.goto(url+'#guide');await page.locator('#guideOv').waitFor({state:'visible'});
    await page.locator('#gdImgWebapp').evaluate(img=>img.decode());
    assert.equal(await page.locator('#guideOv img').count(),3);
    if(output)await page.screenshot({path:path.join(output,'ios-guide.png'),fullPage:true});
    await page.locator('#guideOk').click();assert.equal(await page.evaluate(()=>localStorage.getItem('lx-guide-done')),'1');
    await page.locator('.brand').click({clickCount:3});assert.equal(await page.locator('#guideOv').isVisible(),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#guideOv').isVisible(),false);
    await context.close();
  });

  await test('uprighting preserves reversal and record identity, including extra cards and historical shares',async()=>{
    const {page,context}=await reading({minor:true,rev:true,spread:'2'});
    await page.evaluate(()=>Math.random=()=>.1);
    await pick(page,['M19','M10']);await flip(page);
    const original=(await history(page))[0];
    assert.equal(await page.locator('.straighten:visible').count(),2);
    await page.locator('#rvRow .straighten').first().click();
    await page.waitForTimeout(900);
    const updated=(await history(page))[0];
    assert.equal(updated.id,original.id);assert.equal(updated.ts,original.ts);
    assert.equal(updated.cards[0].rev,true);assert.equal(updated.cards[0].uprighted,true);
    assert.equal(await page.locator('#rvRow .front img.rev').count(),1);
    assert.equal((await page.locator('#rvRow .rrev').first().innerText()).trim(),'逆位（已旋正）');
    await page.locator('.wheel-action').click();await page.locator('#rvExtra .flip').click();
    await page.locator('#rvExtra .straighten').click();
    const record=(await history(page))[0];
    assert.equal(record.cards.at(-1).uprighted,true);
    assert.equal(new Set(record.cards.map(c=>c.key)).size,3,'Extra excludes every main card');
    await page.locator('#historyBtn').click();
    assert.equal(await page.locator('.hd-secondary').count(),1);
    assert.equal(await page.locator('.hd-secondary .hd-thumb').evaluate(el=>el.offsetWidth),32);
    assert.equal(await page.locator('.hd-cards .hd-thumb').first().evaluate(el=>el.offsetWidth),60);
    assert.equal(await page.locator('.hd-cards img.rev').count(),1);
    assert.ok((await page.locator('.hd-names').innerText()).includes('逆位（已旋正）'));
    assert.ok(!(await page.locator('.hd-date').innerText()).includes(new Date().getFullYear()+'年'));
    await page.evaluate(()=>{window.drawn=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){window.drawn.push(t);return f.call(this,t,...a)}});
    await page.locator('.hd-share').click();await page.locator('#shareOv').waitFor({state:'visible'});
    assert.ok((await page.evaluate(()=>window.drawn)).includes('逆位（已旋正）'));
    if(output)fs.writeFileSync(path.join(output,'uprighted-share.png'),Buffer.from((await page.locator('#shareImg').getAttribute('src')).split(',')[1],'base64'));
    await page.locator('#shareClose').click();await page.locator('#drawBtn').click();
    await page.locator('#themeBtn').click();await page.locator('#shareBtn').click();
    await page.locator('#shareOv').waitFor({state:'visible'});
    if(output)fs.writeFileSync(path.join(output,'uprighted-share-dark.png'),Buffer.from((await page.locator('#shareImg').getAttribute('src')).split(',')[1],'base64'));
    assert.deepEqual(await history(page),[record]);
    await context.close();
  });

  await test('hidden cards stay eligible in the remaining deck and do not recalculate after an extra',async()=>{
    const {page,context}=await reading({spread:'3'});
    await pick(page,['M01','M02','M10']);await flip(page); // hidden = M13
    await page.locator('#hCard .flip').click();
    const hname=await page.locator('#hCard .rname').innerText();
    // The same extra draw can choose the conceptual hidden card, but never a primary.
    const remaining=await page.locator('.fcard').evaluateAll(els=>els.map(el=>el.dataset.key).filter(k=>!['M01','M02','M10'].includes(k)));
    const random=(remaining.indexOf('M13')+.1)/remaining.length;
    await page.evaluate(v=>Math.random=()=>v,random);
    await page.locator('.wheel-action').click();await page.locator('#rvExtra .flip').click();
    const cards=(await history(page))[0].cards;
    assert.equal(cards[3].key,'M13');assert.equal(cards[3].hid,true);
    assert.equal(cards[4].key,'M13');assert.equal(cards[4].extra,true);
    assert.equal(await page.locator('#hCard .rname').innerText(),hname);
    await context.close();
  });

  await test('loading remains visible while styles stall, then releases; reduced motion remains usable',async()=>{
    const context=await browser.newContext({viewport:{width:402,height:874},reducedMotion:'reduce'});
    let release;const gate=new Promise(resolve=>release=resolve);
    await context.route('**/css/app.css',async route=>{await gate;await route.continue()});
    const page=await context.newPage();
    const navigation=page.goto(url,{waitUntil:'commit'});
    await page.locator('#appLoading').waitFor({state:'visible'});
    assert.ok(await page.locator('#loadingText').isVisible());
    assert.equal(await page.locator('#loadingText').innerText(),'让直觉，浮出水面');
    const still=await page.locator('.whale-breath').evaluate(el=>({animation:getComputedStyle(el).animationName,position:getComputedStyle(el).backgroundPositionX}));
    assert.equal(still.animation,'none');assert.ok(Math.abs(parseFloat(still.position)-14.285714)<.001);
    release();await navigation;await page.locator('#appLoading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#appShell').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('.brand-whale').evaluate(img=>img.naturalWidth>0),true);
    await context.close();
  });

  await test('loading shows eight real breath frames, honors saved theme, and stays visible for the one-second complete cycle',async()=>{
    const context=await browser.newContext({viewport:{width:402,height:874},colorScheme:'light'});
    await context.addInitScript(()=>{
      localStorage.setItem('lx-theme','dark');
      const decode=HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode=function(){const ready=decode.call(this);return this.src.startsWith('data:image/webp;')?ready.then(()=>new Promise(resolve=>{window.releaseLoadingBack=resolve})):ready};
    });
    let release;const gate=new Promise(resolve=>release=resolve);
    await context.route('**/js/app.js',async route=>{await gate;await route.continue()});
    const page=await context.newPage();const navigation=page.goto(url,{waitUntil:'commit'});
    await page.locator('#appLoading').waitFor({state:'visible'});
    await page.locator('.whale-breath').evaluate(async el=>{
      const img=new Image();img.src=getComputedStyle(el).backgroundImage.slice(5,-2);await img.decode();
    });
    await page.waitForFunction(()=>typeof window.releaseLoadingBack==='function');
    assert.equal(await page.locator('#appLoading').evaluate(el=>el.classList.contains('is-ready')),false);
    await page.evaluate(()=>window.releaseLoadingBack());
    await page.waitForFunction(()=>document.querySelector('#appLoading.is-ready .whale-breath')?.getAnimations().some(a=>a.animationName==='whale-breath'));
    assert.equal((await page.locator('#appLoading').innerText()).trim(),'让直觉，浮出水面');
    assert.equal(await page.locator('#appLoading').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(25, 33, 61)');
    const hashes=[];
    for(let frame=0;frame<8;frame++){
      await page.locator('.whale-breath').evaluate(async(el,frame)=>{
        const animation=el.getAnimations()[0];animation.pause();animation.currentTime=frame*125+20;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      },frame);
      const snapshot=await page.locator('.whale-breath').evaluate(async el=>{
        const style=getComputedStyle(el),image=new Image();image.src=style.backgroundImage.slice(5,-2);await image.decode();
        const index=Math.round(parseFloat(style.backgroundPositionX)/100*7),canvas=document.createElement('canvas');canvas.width=image.width/8;canvas.height=image.height;
        canvas.getContext('2d').drawImage(image,index*canvas.width,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
        return {index,png:canvas.toDataURL('image/png').split(',')[1]};
      });
      assert.equal(snapshot.index,frame);const png=Buffer.from(snapshot.png,'base64');
      hashes.push(require('node:crypto').createHash('sha256').update(png).digest('hex'));
      if(output&&[3,5].includes(frame))fs.writeFileSync(path.join(output,'loading-frame-'+frame+'.png'),png);
    }
    assert.equal(new Set(hashes).size,8,'Each frame must show a different drawing');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('.whale-breath').evaluate(el=>{const a=el.getAnimations()[0];a.currentTime=1000;a.play()});
    release();await navigation;await page.locator('#appLoading').waitFor({state:'hidden'});
    await context.close();
  });

  await test('icon notice displays for missing/zero flag in every browser and only dismissal persists one',async()=>{
    for(const [stored,returning,standalone,expected] of [[null,false,false,true],['0',true,false,true],['1',false,false,false],[null,true,true,true],['1',true,true,false]]){
      const context=await browser.newContext();
      await context.addInitScript(({stored,returning,standalone})=>{
        if(!localStorage.getItem('test-notice-seeded')){
          localStorage.setItem('test-notice-seeded','1');
          if(stored!==null)localStorage.setItem('lx-icon-notice-v2',stored);
          if(returning)localStorage.setItem('lx-visited','1');
          localStorage.setItem('lx-upd-2026-10a','1'); // The old gate cannot suppress v2.
          localStorage.setItem('lx-guide-done','1');
        }
        Object.defineProperty(navigator,'standalone',{value:standalone});
      },{stored,returning,standalone});
      const page=await context.newPage();await page.goto(url);await page.locator('#appLoading').waitFor({state:'hidden'});
      assert.equal(await page.locator('#updateOv').isVisible(),expected);
      if(expected){
        assert.equal(await page.evaluate(()=>document.activeElement.id),'updClose');
        assert.notEqual(await page.evaluate(()=>localStorage.getItem('lx-icon-notice-v2')),'1','Opening alone must not mark seen');
        if(output)await page.screenshot({path:path.join(output,'update.png')});
        await page.locator('#updClose').click();assert.equal(await page.locator('#updateOv').isVisible(),false);
        assert.equal(await page.evaluate(()=>localStorage.getItem('lx-icon-notice-v2')),'1');
        await page.reload();await page.locator('#appLoading').waitFor({state:'hidden'});
        assert.equal(await page.locator('#updateOv').isVisible(),false);
      }
      await page.goto(url+'#guide');await page.locator('#guideOv').waitFor({state:'visible'});
      await page.locator('#guideOk').click();await page.waitForTimeout(100);
      assert.equal(await page.locator('#updateOv').isVisible(),false);
      if(stored==='1'){
        await page.goto(url+'?source=preview#update');await page.locator('#appLoading').waitFor({state:'hidden'});
        assert.equal(await page.locator('#updateOv').isVisible(),true);await page.keyboard.press('Escape');
      }
      await context.close();
    }
  });

  await test('first iOS onboarding yields to the unseen icon notice, then both stay dismissed',async()=>{
    const context=await browser.newContext({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
    const page=await context.newPage();await page.goto(url);await page.locator('#appLoading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#guideOv').isVisible(),true);assert.equal(await page.locator('#updateOv').isVisible(),false);
    await page.locator('#guideOk').click();await page.locator('#updateOv').waitFor({state:'visible'});
    await page.locator('#updOk').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('lx-icon-notice-v2')),'1');
    await page.reload();await page.locator('#appLoading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#guideOv').isVisible(),false);assert.equal(await page.locator('#updateOv').isVisible(),false);
    await context.close();
  });

  await test('reading names, reversed controls, supplements and actions stay in content flow across heights',async()=>{
    const {page,context}=await reading({spread:'3',rev:true});await page.evaluate(()=>Math.random=()=>.1);
    await pick(page,['M19','M20','M07']);await flip(page);await page.locator('#hCard .flip').click();
    await page.locator('.wheel-action').click();await page.locator('#rvExtra .flip').click();await page.waitForTimeout(700);
    for(const [width,height] of [[320,568],[402,874],[430,932],[844,390]]){
      await page.setViewportSize({width,height});
      const layout=await page.evaluate(()=>{
        const rect=id=>document.querySelector(id).getBoundingClientRect();
        const main=rect('#rvRow'),supplement=rect('.rv-supplement'),actions=rect('.rv-acts');
        const overlap=[...document.querySelectorAll('#reveal .rcard')].some(card=>{
          const name=card.querySelector('.rname').getBoundingClientRect(),flip=card.querySelector('.flip').getBoundingClientRect();
          const controls=card.querySelector('.rrev')?.getBoundingClientRect();
          return name.top<flip.bottom+5||(controls&&controls.top<name.bottom);
        });
        return {supplementGap:supplement.top-main.bottom,actionGap:actions.top-supplement.bottom,overlap,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.ok(layout.supplementGap>=23&&layout.supplementGap<=41,JSON.stringify({width,height,...layout}));
      assert.ok(layout.actionGap>=23&&layout.actionGap<=41,JSON.stringify({width,height,...layout}));
      assert.equal(layout.overlap,false);assert.equal(layout.overflow,false);
      if(output&&width===402)await page.screenshot({path:path.join(output,'reading-responsive.png'),fullPage:true});
    }
    await context.close();
  });

  await test('slots have explicit horizontal rows, icons render locally, loading reuses one decoded inline back after a complete one-second cycle',async()=>{
    const context=await browser.newContext({viewport:{width:402,height:690},isMobile:true,hasTouch:true});
    await context.addInitScript(()=>{localStorage.setItem('lx-icon-notice-v2','1');localStorage.setItem('lx-guide-done','1');
      new MutationObserver(()=>{const el=document.getElementById('appLoading');if(el?.classList.contains('is-ready')&&window.orcaCycleStarted===undefined)window.orcaCycleStarted=performance.now();if(el?.hidden&&window.orcaLoadingHiddenAt===undefined)window.orcaLoadingHiddenAt=performance.now()}).observe(document,{subtree:true,attributes:true,attributeFilter:['hidden','class']});
    });
    const page=await context.newPage();await page.goto(url);await page.locator('#appLoading').waitFor({state:'hidden'});
    const duration=await page.evaluate(()=>window.orcaLoadingHiddenAt-window.orcaCycleStarted);assert.ok(duration>=990,JSON.stringify({duration}));
    assert.equal(await page.locator('#spreadIcon use').getAttribute('href'),'#spread-3');
    assert.ok(await page.locator('#spreadIcon svg').evaluate(el=>el.getBBox().width>0));
    assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/icons.*\.svg/.test(r.name)).length),0);
    const core=await page.evaluate(async()=>{const {IMG}=await import('./js/images.js'),{getLoadedImage}=await import('./js/card-images.js');return {same:getLoadedImage(IMG.BACK)===window.orcaBackImage,width:window.orcaBackImage?.naturalWidth,backRequests:performance.getEntriesByType('resource').filter(r=>/card-back\./.test(r.name)).length,iterations:getComputedStyle(document.querySelector('.whale-breath')).animationIterationCount}});
    assert.equal(core.same,true);assert.ok(core.width>0);assert.equal(core.backRequests,0);assert.equal(core.iterations,'1');
    for(const spread of ['1','2','3','bday']){
      if(spread==='bday')await page.evaluate(()=>localStorage.setItem('lx-prefs',JSON.stringify({spread:'bday'})));
      else await page.evaluate(spread=>localStorage.setItem('lx-prefs',JSON.stringify({spread})),spread);
      await page.reload();await page.locator('#appLoading').waitFor({state:'hidden'});
      const boxes=await page.locator('#slots .slot').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
      const count=spread==='bday'?5:+spread;assert.equal(boxes.length,count);
      for(let i=1;i<Math.min(3,count);i++){assert.ok(Math.abs(boxes[i].y-boxes[0].y)<1,JSON.stringify(boxes));assert.ok(boxes[i].x>boxes[i-1].x)}
      if(count===5){assert.ok(boxes[3].y>boxes[0].y);assert.ok(Math.abs(boxes[3].y-boxes[4].y)<1)}
      if(output&&spread==='3')await page.screenshot({path:path.join(output,'safari-horizontal-slots.png')});
    }
    await context.close();
  });

  await test('birthday form is immediately selected; history captions belong under cards with centered 3+2 sharing',async()=>{
    const {page,context}=await reading();await page.locator('#spreadInd').click();await page.locator('#bdayHead').click();
    assert.equal(await page.locator('#bdayRow').getAttribute('class'),'sp-row on');assert.equal(await page.locator('#bdayHead').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.sp-row.on').count(),1);assert.equal(await page.locator('#bdayForm').isVisible(),true);
    const settings=await page.locator('.reading-options').evaluate(el=>{const a=el.children[0].getBoundingClientRect(),b=el.children[1].getBoundingClientRect();return {left:a.x-el.getBoundingClientRect().x,gap:b.x-a.right}});
    assert.ok(Math.abs(settings.left)<1&&settings.gap>=16&&settings.gap<=24,JSON.stringify(settings));
    await page.locator('#bY').fill('1990');await page.locator('#bM').fill('7');await page.locator('#bD').fill('3');await page.locator('#bStart').click();await flip(page);
    await page.locator('#historyBtn').click();
    assert.deepEqual(await page.locator('.hd-cards .hd-kind').allTextContents(),['年','月','日','业力','流年']);
    assert.equal(await page.locator('.hd-kind').evaluateAll(els=>els.some(el=>/[：:]/.test(el.textContent))),false);
    assert.equal(await page.locator('.hd-date').evaluateAll(els=>els.some(el=>/[：:]/.test(el.textContent))),false);
    const positionBounds=await page.locator('.hd-reading-card').evaluateAll(els=>els.map(el=>({label:el.querySelector('.hd-kind').getBoundingClientRect().bottom,card:el.querySelector('.hd-thumb').getBoundingClientRect().top})));
    assert.ok(positionBounds.every(r=>r.label<r.card));
    const figures=await page.locator('.hd-cards .hd-reading-card').evaluateAll(els=>els.map(el=>{const r=el.querySelector('.hd-thumb').getBoundingClientRect(),cap=el.querySelector('figcaption').getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,captionTop:cap.top}}));
    assert.equal(figures.length,5);assert.ok(figures.every(r=>r.captionTop>=r.bottom+5));assert.ok(figures.slice(0,3).every(r=>Math.abs(r.y-figures[0].y)<1));assert.ok(figures.slice(3).every(r=>Math.abs(r.y-figures[3].y)<1&&r.y>figures[0].y));
    await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.hd-scroll')).opacity)===1&&[...document.querySelectorAll('.hd-cards img')].every(i=>i.complete&&i.naturalWidth>0));
    if(output)await page.screenshot({path:path.join(output,'history-caption-birthday.png'),fullPage:true});
    await page.evaluate(()=>{window.positions=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(['年','月','日','业力','流年'].includes(text))window.positions.push({text,x,y});return f.call(this,text,x,y,...rest)}});
    await page.locator('.hd-share').click();await page.locator('#shareOv').waitFor({state:'visible'});
    const positions=await page.evaluate(()=>window.positions);assert.equal(positions.length,5);assert.equal(positions[0].y,positions[2].y);assert.equal(positions[3].y,positions[4].y);assert.ok(positions[3].y>positions[0].y);assert.ok(positions[3].x<375&&positions[4].x>375);
    if(output)fs.writeFileSync(path.join(output,'birthday-share-3-2.png'),Buffer.from((await page.locator('#shareImg').getAttribute('src')).split(',')[1],'base64'));
    await context.close();
  });

  await test('card backs need no network during fan, flight, slots and reveal; faces decode before flipping',async()=>{
    const context=await browser.newContext({viewport:{width:402,height:760}});
    await context.addInitScript(()=>{
      localStorage.setItem('lx-guide-done','1');localStorage.setItem('lx-icon-notice-v2','1');localStorage.setItem('lx-prefs',JSON.stringify({spread:'3',minor:false}));
      const decode=HTMLImageElement.prototype.decode;let held=false;
      HTMLImageElement.prototype.decode=function(){const ready=decode.call(this);if(this.hasAttribute('data-card-src')&&!held){held=true;return ready.then(()=>new Promise(resolve=>{window.releaseFace=resolve}))}return ready};
    });
    let backRequests=0;await context.route('**/card-back.*.webp',route=>{backRequests++;return route.abort()});
    const page=await context.newPage();await page.goto(url);await page.locator('#appLoading').waitFor({state:'hidden'});
    assert.equal(await page.locator('.fcard img').count(),0);
    await page.locator('.fcard[data-key="M01"]').dispatchEvent('click');
    assert.equal(await page.locator('.flyghost .back-art').evaluate(el=>getComputedStyle(el).backgroundImage.includes('data:image/webp;base64,')),true);
    await page.waitForTimeout(510);assert.equal(await page.locator('.slot.done .back-art').count(),1);
    await pick(page,['M02','M03']);await page.waitForFunction(()=>typeof window.releaseFace==='function');
    const card=page.locator('#rvRow .rcard').first();await card.locator('.flip').click();
    assert.equal(await card.locator('.flip').getAttribute('aria-busy'),'true');assert.equal(await card.evaluate(el=>el.classList.contains('flipped')),false);
    assert.equal(await card.locator('.face.back .back-art').evaluate(el=>getComputedStyle(el).backgroundImage.includes('data:image/webp;base64,')),true);
    await page.evaluate(()=>window.releaseFace());await card.locator('.front img').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#rvRow .rcard').classList.contains('flipped'));
    assert.equal(await card.evaluate(el=>el.classList.contains('front-ready')),true);
    assert.equal(await card.locator('.front img').evaluate(el=>el.complete&&el.naturalWidth>0),true);
    assert.equal(backRequests,0);
    if(output)await page.screenshot({path:path.join(output,'decoded-back-and-face.png')});
    await context.close();
  });

  await test('dark artwork is a dedicated normal-color asset without CSS or Canvas inversion',async()=>{
    const {page,context}=await reading({spread:'1'});await page.locator('#themeBtn').click();
    const artwork=await page.locator('.brand-whale').evaluate(img=>({src:img.src,filter:getComputedStyle(img).filter,blend:getComputedStyle(img).mixBlendMode}));
    assert.ok(artwork.src.includes('app-icon-orca-dark.'));assert.equal(artwork.filter,'none');assert.equal(artwork.blend,'normal');
    assert.ok((await page.locator('.whale-breath').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('whale-breath-dark-strip.'));
    assert.equal(await page.locator('.whale-breath').evaluate(el=>getComputedStyle(el).filter),'none');
    await pick(page,['M19']);await flip(page);
    await page.evaluate(()=>{window.inversions=[];const proto=CanvasRenderingContext2D.prototype;for(const key of ['filter','globalCompositeOperation']){const original=Object.getOwnPropertyDescriptor(proto,key);if(original?.set)Object.defineProperty(proto,key,{...original,set(value){if(String(value).includes('invert')||value==='screen')window.inversions.push(value);original.set.call(this,value)}})}});
    await page.locator('#shareBtn').click();await page.locator('#shareOv').waitFor({state:'visible'});assert.deepEqual(await page.evaluate(()=>window.inversions),[]);
    if(output)fs.writeFileSync(path.join(output,'normal-dark-art-share.png'),Buffer.from((await page.locator('#shareImg').getAttribute('src')).split(',')[1],'base64'));
    await context.close();
  });


  await test('questions stay local, wrap with native fonts, and persist through extra cards, history and shares',async()=>{
    const {page,context}=await reading({spread:'1'});
    const question=('转职 & 去留 <img src=x onerror=alert(1)> 🐋，接下来应该怎么做？').repeat(3);
    const expected=question.slice(0,120);
    const fontsBefore=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\.woff2?/.test(r.name)).length);
    await page.locator('#questionInput').fill(question);
    await pick(page,['M10']);
    assert.equal(await page.locator('#readingQuestion').innerText(),expected);
    assert.equal(await page.locator('#questionEditor').isVisible(),false);
    assert.ok((await page.locator('#readingQuestion').evaluate(el=>getComputedStyle(el).fontFamily)).includes('system-ui'));
    await flip(page);const original=(await history(page))[0];assert.equal(original.question,expected);
    await page.locator('.wheel-action').click();await page.locator('#rvExtra .flip').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lx-history'))[0].cards.length===2);
    const updated=(await history(page))[0];assert.equal(updated.id,original.id);assert.equal(updated.question,expected);
    await page.evaluate(()=>{window.textDraws=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){window.textDraws.push({text,x,y,font:this.font,width:this.measureText(text).width});return original.call(this,text,x,y,...rest)}});
    await page.locator('#shareBtn').click();await page.locator('#shareOv').waitFor({state:'visible'});
    async function checkShare(){
      const texts=await page.evaluate(()=>window.textDraws),questionLines=texts.filter(t=>t.font.includes('system-ui'));
      assert.equal(questionLines.map(t=>t.text).join(''),expected);assert.ok(questionLines.length>1);
      assert.ok(questionLines.every(t=>t.width<=626&&t.x===375));
      assert.ok(texts.some(t=>t.text==='让直觉，浮出水面'));
    }
    await checkShare();
    if(output)fs.writeFileSync(path.join(output,'question-share.png'),Buffer.from((await page.locator('#shareImg').getAttribute('src')).split(',')[1],'base64'));
    await page.locator('#shareClose').click();await page.locator('#historyBtn').click();
    assert.equal(await page.locator('.hd-question').innerText(),expected);assert.equal(await page.locator('.hd-question img').count(),0);
    await page.evaluate(()=>window.textDraws=[]);await page.locator('.hd-share').click();await page.locator('#shareOv').waitFor({state:'visible'});await checkShare();
    await page.locator('#shareClose').click();await page.locator('#drawBtn').click();await page.locator('#reShuffle').click();
    assert.equal(await page.locator('#readingQuestion').isVisible(),false);assert.equal(await page.locator('#questionEditor').isVisible(),true);
    await page.locator('#questionInput').fill('   ');await pick(page,['M01']);await flip(page);
    assert.equal(await page.locator('#readingQuestion').isVisible(),false);assert.equal((await history(page))[0].question,undefined);
    await page.locator('#historyBtn').click();assert.equal(await page.locator('.hd-item').first().locator('.hd-question').count(),0);
    const fontsAfter=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\.woff2?/.test(r.name)).length);assert.equal(fontsAfter,fontsBefore);
    await context.close();
  });

  assert.deepEqual(errors,[],'Uncaught browser errors');
  const report={passed:reports,failures,errors,limitations};
  if(output)fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
  return report;
}
module.exports={run};
if(require.main===module) {
  const engine=process.env.BROWSER_ENGINE||'chromium';const launcher=require('playwright')[engine];
  (async()=>{const browser=await launcher.launch({headless:true});try{const report=await run(browser,process.argv[2]||'http://127.0.0.1:8765/',process.argv[3]);console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
}
