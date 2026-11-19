// A FRAME RECORDER FOR THE TEST COPY (tools/phone-probe.mjs --script).
//
//   node tools/phone-probe.mjs --script tools/probe-frames.js
//
// Played by a person, not a harness: every frame over 50 ms is written down
// with whose turn it was and how long after the last strike it came, and once
// a minute the page sends what it saw (`frames` reports, bench/probe/). The
// question it answers is the one tools/frame-round.mjs left open on 18
// November 2026 (TODO, *Ultra: about two more stalls a minute with three
// computer golfers*): do the stalls 150-270 ms after a computer golfer's
// strike show up in a round someone actually plays, and how often.
//
// It reads `window.lab.state()`, which the shipped page has; the probe page
// alone adds this file, so dist/ and the release never carry it. Frames while
// the page is hidden are not counted (a hidden tab stops drawing). Plain ES5,
// like the probe it rides on.
(function(){
 var LONG=50, last=0, frames=0, sum=0, over=0, worst=0, long=[], strike=null, flying=false, started=Date.now();
 var gl=null, renderer='unknown';
 try{gl=document.createElement('canvas').getContext('webgl2');var d=gl&&gl.getExtension('WEBGL_debug_renderer_info');if(d)renderer=gl.getParameter(d.UNMASKED_RENDERER_WEBGL);}catch(e){}
 function settings(){var o={};try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!/setting|graphic|quality|tier/i.test(k))continue;var v=localStorage.getItem(k);try{var j=JSON.parse(v);if(j&&typeof j==='object'){for(var f in j)if(/quality|tier|graphic|render|fps|cap/i.test(f))o[k+'.'+f]=j[f];}else o[k]=v;}catch(e){o[k]=String(v).slice(0,80);}}}catch(e){}return o;}
 function state(){try{return window.lab&&window.lab.state();}catch(e){return null;}}
 function tick(now){
  requestAnimationFrame(tick);
  if(document.hidden){last=0;return;}
  var s=state(), t=s&&s.turn, fly=!!(s&&s.inFlight);
  // A strike is the ball leaving: in flight now, not on the frame before.
  if(fly&&!flying)strike={at:now,computer:!!(t&&t.computer),hole:t?t.hole:null,player:t?t.active:null};
  flying=fly;
  if(last){var dt=now-last;
   // A gap over two seconds is a pause (a menu's alert, the tab coming back), not a frame.
   if(dt<2000){frames++;sum+=dt;if(dt>worst)worst=dt;
    if(dt>LONG){over++;long.push({ms:Math.round(dt),afterStrike:strike?Math.round(now-strike.at):null,strikeBy:strike?(strike.computer?'computer':'person'):null,inFlight:fly,computerTurn:!!(t&&t.computer),hole:t?t.hole:null});}}}
  last=now;
 }
 requestAnimationFrame(tick);
 function report(why){
  if(!frames)return;
  window.fairwayProbe.send('frames',{why:why,minutes:+((Date.now()-started)/60000).toFixed(1),frames:frames,meanMs:+(sum/frames).toFixed(2),over50:over,worstMs:Math.round(worst),
   long:long,renderer:renderer,screen:[innerWidth,innerHeight,devicePixelRatio],settings:settings()});
  frames=0;sum=0;over=0;worst=0;long=[];
 }
 setInterval(function(){report('minute');},60000);
 document.addEventListener('visibilitychange',function(){if(document.hidden)report('hidden');});
})();
