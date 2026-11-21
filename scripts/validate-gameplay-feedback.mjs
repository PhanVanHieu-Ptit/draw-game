#!/usr/bin/env node
// Focused gameplay feedback scenarios in real Chrome, using the repository's CDP harness.
import fs from 'node:fs';
import path from 'node:path';
import { Bench } from './perf-bench.mjs';
const out = 'docs/gameplay-feedback';
fs.mkdirSync(`${out}/screenshots`, { recursive: true });
const b = new Bench({});
const report = { checks: [], layouts: [], limitations: ['Chrome emulation; physical devices and listening tests were not performed.'] };
const check = (name, pass) => { report.checks.push({ name, pass: !!pass }); if (!pass) console.error(`FAIL: ${name}`); };
const settle = p => p.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
async function screenshot(page, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${out}/screenshots/${name}.png`, Buffer.from(data, 'base64'));
}
const measure = `(() => {
  const bounds = id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,overflow:e.scrollWidth > e.clientWidth + 1}; };
  const arena = bounds('game-arena'), rail = bounds('game-notices'), hud = document.querySelector('.hud-dock').getBoundingClientRect();
  const cast = bounds('gesture-feedback'), combo = bounds('combo-badge');
  const controls = [...document.querySelectorAll('#hud-playing .icon-btn')].map(e => {const r=e.getBoundingClientRect();return {width:r.width,height:r.height,right:r.right}});
  const cooldown = document.getElementById('spell-cooldowns');
  return {viewport:[innerWidth,innerHeight],arena,rail,hudBottom:hud.bottom,cast,combo,controls,
    noPageOverflow:document.documentElement.scrollWidth <= innerWidth,
    cooldowns:cooldown.children.length, cooldownOverflow:cooldown.scrollWidth > cooldown.clientWidth + 1,
    readoutOverflow:document.getElementById('combat-readout').scrollWidth > document.getElementById('combat-readout').clientWidth + 1,
    errors:__perf.errors};
})()`;
let page;
try {
  await b.start();
  const url = await b.serveRoot(path.resolve('dist'));
  page = await b.newPage('desktop');
  await b.load(page, url);
  await page.eval(`(() => {
    const g=__ARCANE_GAME__; __bench.play(); g.isRunning=false; cancelAnimationFrame(g._rafId);
    g.settings.set('highlight',false); g.settings.set('storyLines',false);
    g.uiManager.levelTransitionBanner.classList.remove('show');
    g.uiManager.clearGameplayNotice();
    g.runConfiguration={...g.runConfiguration,values:{...g.runConfiguration.values,spells:{...g.runConfiguration.values.spells,cooldownSeconds:2}}};
    g._configurationTime=5; g._spellReadyAt={horizontal:6.5,vertical:5.5};
    g.player.hp=1; g.player.isInvulnerable=true; g.player.invulnerableTimer=1.8;
    g.uiManager.updateHearts(1,g.player.maxHp);
    g.comboCount=12;g.comboMultiplier=3;g.comboTimer=.5;
    g.uiManager.updateCombo(12,3,.1);
    g.uiManager.showGestureFeedback('horizontal',.99,true,null,null,{perfect:true,targets:4});
  })()`);
  const sizes = [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[568,320],[844,390]];
  for (const [width,height] of sizes) {
    for (const compact of [false,true]) {
      await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await page.eval(`__ARCANE_GAME__.settings.set('compactHud',${compact})`);
      await settle(page);
      await page.eval(`(() => {
        const g=__ARCANE_GAME__;
        if(g.stateMachine.getCurrentStateName()!=='PLAYING')g.stateMachine.changeState('PLAYING');
        g.cancelResumeCountdown();g.inputHandler.setEnabled(true);
        g.uiManager.updateCombo(12,3,.1);
        g.uiManager.showGestureFeedback('horizontal',.99,true,null,null,{perfect:true,targets:4});
        for(const e of g.enemies)g.enemyPool.release(e);g.enemies=[];
        __bench.park(8);
        const boss=g.enemyPool.acquire();boss.init({type:'BOSS_LIBRARIAN',x:g.width*.72,y:g.height*.36,canvasWidth:g.width,canvasHeight:g.height,bossLives:3,bossPhases:[['horizontal','vertical'],['caret','v_shape'],['lightning']],symbolQueue:['horizontal','vertical']});
        boss.speed=60;g.enemies.push(boss);
        const urgent=g.enemies[0];urgent.x=g.player.x-100;urgent.y=g.player.y;urgent.speed=90;
        g.uiManager.updateGameplayFeedback(0);g.render();
      })()`);
      const layout=await page.eval(measure);layout.compact=compact;report.layouts.push(layout);
      const label=`${width}x${height} ${compact?'compact':'standard'}`;
      check(`${label}: no horizontal overflow`,layout.noPageOverflow&&!layout.cooldownOverflow&&!layout.readoutOverflow);
      check(`${label}: rails stay outside arena and header`,layout.hudBottom<=layout.rail.y+1&&layout.rail.bottom<=layout.arena.y+1&&layout.cast.y>=layout.arena.bottom-1);
      check(`${label}: readable combo and 44px controls`,layout.combo.width>60&&layout.controls.every(c=>c.width>=44&&c.height>=44&&c.right<=width));
      check(`${label}: all eight cooldowns and no runtime errors`,layout.cooldowns===8&&layout.errors.length===0);
      if ([[320,568],[1440,900],[568,320]].some(([w,h])=>w===width&&h===height)) await screenshot(page,`${width}x${height}-${compact?'compact':'standard'}`);
    }
  }
  for (const [width,height] of [[320,568],[568,320],[844,390]]) {
    await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await settle(page);
    await page.eval(`(() => {
      const g=__ARCANE_GAME__;if(g.stateMachine.getCurrentStateName()!=='PLAYING')g.stateMachine.changeState('PLAYING');
      g.cancelResumeCountdown();g.settings.set('altInput',true);g.settings.set('compactHud',true);
    })()`);
    await settle(page);
    await page.eval(`(() => {const g=__ARCANE_GAME__;if(g.stateMachine.getCurrentStateName()!=='PLAYING')g.stateMachine.changeState('PLAYING');g.cancelResumeCountdown();g.uiManager.showGestureFeedback(null,.3,false,'Vẽ ấn ký đầu tiên của đối thủ.',{reason:'unrecognized'});g.uiManager.updateGameplayFeedback(0);g.render();})()`);
    const m=await page.eval(`(() => {
      const arena=document.getElementById('game-arena').getBoundingClientRect();
      const items=[...document.querySelectorAll('#rune-pad button,#gesture-feedback,.gesture-hint.show')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,left:r.left,right:r.right,bottom:r.bottom};});
      return {arenaBottom:arena.bottom,arenaHeight:arena.height,items,buttons:document.querySelectorAll('#rune-pad button').length};
    })()`);
    (report.altLayouts ||= []).push({viewport:[width,height],...m});
    check(`${width}x${height}: alternative input and incorrect-gesture hint stay outside arena`,m.buttons===8&&m.items.every(i=>i.top>=m.arenaBottom-1&&i.left>=0&&i.right<=width+1&&i.bottom<=height+1));
    await screenshot(page,`${width}x${height}-rune-pad`);
    await page.eval(`__ARCANE_GAME__.settings.set('altInput',false)`);
    await settle(page);
  }
  check('urgent target hides routine dialogue and toasts',await page.eval(`(() => {
    const g=__ARCANE_GAME__;g.uiManager.dialogueToast.classList.add('show');g.uiManager.meta.showToast('routine');
    g.uiManager.updateGameplayFeedback(0);
    return getComputedStyle(g.uiManager.dialogueToast).display==='none'&&getComputedStyle(document.getElementById('toast-stack')).display==='none';
  })()`));
  check('boss phase announcement resists routine hit messages',await page.eval(`(() => {
    const g=__ARCANE_GAME__,boss=g.enemies.find(e=>e.isBoss);
    boss.bossLives=2;boss.startBossRetreat(true);
    g.uiManager.showGameplayNotice('CHUYỂN PHA','#fff',4);
    g.uiManager.showGameplayNotice('routine','#fff');
    g.uiManager.updateGameplayFeedback(0);
    return g.uiManager.gameplayNotice.textContent==='CHUYỂN PHA'&&document.getElementById('boss-label').textContent.includes('CHUYỂN PHA');
  })()`));
  check('cooldown attempt changes no HP, score, combo or ready time',await page.eval(`(() => {
    const g=__ARCANE_GAME__;g.uiManager._castChannel.clear();g._spellReadyAt.horizontal=6.5;
    const before=JSON.stringify([g.score,g.player.hp,g.comboCount,g._spellReadyAt]);g.executeSpell({gesture:'horizontal',score:1},[]);
    return before===JSON.stringify([g.score,g.player.hp,g.comboCount,g._spellReadyAt])&&g.uiManager.gestureFeedback.textContent.includes('HỒI CHIÊU');
  })()`));
  check('reduced motion preserves static cues and removes CSS animations',await page.eval(`(() => {
    const g=__ARCANE_GAME__;g.settings.set('reducedEffects',true);g.triggerShake(20,.5);g.uiManager.updateGameplayFeedback(0);g.render();
    return g.player.reducedMotion&&g.particleSystem.screenShake.timer===0&&document.getElementById('threat-cue').textContent.includes('SẮP ĐÁNH')&&getComputedStyle(document.getElementById('boss-fill')).transitionDuration==='0s';
  })()`));
  await screenshot(page,'reduced-motion');
  check('pause and resume freeze gameplay timers and reject casts throughout 3-2-1',await page.eval(`(() => {
    const g=__ARCANE_GAME__;g.stateMachine.changeState('PAUSE');
    const snapshot=()=>JSON.stringify([g.player.hp,g.player.invulnerableTimer,g.comboTimer,g._configurationTime,g._spellReadyAt]);const before=snapshot();
    g.update(1);if(snapshot()!==before)return false;
    g.stateMachine.changeState('PLAYING');if(g.resumeCountdown!==3||g.inputHandler.isEnabled)return false;
    g.update(.5);g.executeSpell({gesture:'horizontal',score:1},[]);
    return snapshot()===before&&g.resumeCountdown===2.5&&document.getElementById('countdown-num').textContent==='3';
  })()`));
  await screenshot(page,'resume-countdown');
  const pauseButton = await page.eval(`(() => {const r=document.getElementById('btn-pause').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...pauseButton,button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...pauseButton,button:'left',buttons:0,clickCount:1});
  check('the pause button remains usable during resume countdown',await page.eval(`__ARCANE_GAME__.stateMachine.getCurrentStateName()==='PAUSE'&&__ARCANE_GAME__.resumeCountdown===0`));
  check('all runtime error checks',await page.eval('__perf.errors.length===0'));
} catch(error) { report.error=error.stack;console.error(error); }
finally { if(page)await page.close();await b.stop(); }
report.ok=!report.error&&report.checks.every(c=>c.pass);
fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify(report,null,2)+'\n');
console.log(`${report.checks.filter(c=>c.pass).length}/${report.checks.length} checks passed`);
if(!report.ok)process.exitCode=1;
