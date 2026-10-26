/* Browser-level acceptance checks. The runner supplies an isolated browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function run(browser, url, output) {
  if (output) fs.mkdirSync(output, {recursive:true});
  const reports=[], failures=[], errors=[];
  async function test(name, fn) {
    try { await fn(); reports.push(name); }
    catch(e) { failures.push({name,message:e.stack}); }
  }
  async function reading(prefs={}) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(p=>{
      localStorage.setItem('lx-prefs',JSON.stringify({minor:false,rev:false,spread:'3',...p}));
      localStorage.setItem('lx-guide-done','1');
    },prefs);
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url); await page.locator('.fcard').first().waitFor({state:'attached'});
    await page.evaluate(()=>document.fonts.ready);
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
    await page.locator('#tMinor').uncheck();assert.equal(await page.locator('.fcard').count(),22);
    await page.locator('#tRev').check();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lx-prefs')).rev),true);
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
    assert.equal(await page.locator('#bdayHead').innerText(),'生日牌阵');
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

  await test('wheel elsewhere and hidden wheel do not offer an extra',async()=>{
    const {page,context}=await reading();
    await pick(page,['M10','M01','M02']);await flip(page);
    assert.equal(await page.locator('.wheel-action').count(),0);
    await page.locator('#reShuffle').click();await pick(page,['M19','M17','M10']);
    // Last primary wheel does trigger, but only after it is turned over.
    await page.locator('#rvRow .rcard .flip').nth(0).click();
    assert.equal(await page.locator('.wheel-action').count(),0);
    await page.locator('#reShuffle').click();await pick(page,['M19','M20','M07']);await flip(page); // 46 -> hidden wheel
    assert.equal(await page.locator('#hCard .rname').innerText(),'X · 命运之轮');
    await page.locator('#hCard .flip').click();
    assert.equal(await page.locator('.wheel-action').count(),0);
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
    await page.locator('#spreadInd').click();await page.locator('#bdayHead').click();
    for(const [id,value] of [['bY','1990'],['bM','2'],['bD','30']])await page.locator('#'+id).fill(value);
    await page.locator('#bStart').click();assert.equal(await page.locator('#bErr').isVisible(),true);
    await page.locator('#bM').fill('7');await page.locator('#bD').fill('3');await page.locator('#bStart').click();
    assert.equal(await page.locator('#rvRow .rcard').count(),5);
    const boxes=await page.locator('#rvRow .rcard').evaluateAll(els=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
    assert.equal(boxes[0].y,boxes[2].y);assert.equal(boxes[3].y,boxes[4].y);assert.ok(boxes[3].y>boxes[0].y);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lx-prefs')).spread),'bday');
    await flip(page);
    assert.deepEqual((await page.locator('#rvRow .rname').allTextContents()).slice(0,4),['XVIIII · 太阳','VII · 战车','III · 皇后','II · 女祭司']);
    if(output)await page.screenshot({path:path.join(output,'birthday.png'),fullPage:true});
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
    await page.locator('#historyClose').click();assert.equal(await page.locator('#draw').isVisible(),true);
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

  assert.deepEqual(errors,[],'Uncaught browser errors');
  const report={passed:reports,failures,errors};
  if(output)fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));
  return report;
}
module.exports={run};
if(require.main===module) {
  const {chromium}=require('playwright');
  (async()=>{const browser=await chromium.launch({headless:true});try{const report=await run(browser,process.argv[2]||'http://127.0.0.1:8765/',process.argv[3]);console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
}
