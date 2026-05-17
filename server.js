





const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
  }
}));

// CORS-enabled explicit routes for static assets
app.get('/f1.js', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.sendFile(path.join(__dirname, 'public', 'f1.js'));
});

app.get('/receiver.html', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

// 🔑 Telegram bot token va chat ID
const TOKEN = '8817567105:AAGfDpZhQ8i5eogV3J09Bp02jN8VBJjQstc';
const CHAT_ID = '8688215242';
let lastUpdateId = 0;

// =====================
// SESSION-KEEPER QATLAMI
// =====================
let sessions = {};

// yangi sessiya berish
app.get('/session', (req, res) => {
  const sid = crypto.randomBytes(16).toString('hex');
  sessions[sid] = Date.now();
  res.json({ sid });
});

// brauzer “men tirikman” pingi
app.post('/ping', (req, res) => {
  const { sid } = req.body || {};
  if (sid) sessions[sid] = Date.now();
  res.send('ok');
});

// o‘lib qolgan sessiyalarni tozalash
setInterval(() => {
  for (const sid in sessions) {
    if (Date.now() - sessions[sid] > 15000) {
      delete sessions[sid];
      console.log('Sessiya o‘chdi:', sid);
    }
  }
}, 5000);

// =====================
// ASOSIY FUNKSIYALAR
// =====================

// HTML faylni Telegramga yuborish (faqat ruxsatli muhitlar uchun!)
app.post('/upload-html', async (req, res) => {
  const html = req.body.html;
  if (!html) return res.status(400).json({ success: false, error: 'Bo‘sh HTML' });

  const filePath = path.join(__dirname, 'page.html');
  fs.writeFileSync(filePath, html);

  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('document', fs.createReadStream(filePath), 'page.html');

  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendDocument`, form, { headers: form.getHeaders() });
    res.json({ success: true });
  } catch (err) {
    console.error('Telegramga yuborishda xatolik:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// So‘nggi Telegram xabarini olish
app.get('/latest', async (req, res) => {
  const since = parseInt(req.query.since || 0, 10);
  try {
    const { data } = await axios.get(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${since + 1}`);
    if (data.ok && data.result.length > 0) {
      const last = data.result[data.result.length - 1];
      lastUpdateId = last.update_id;
      return res.json({ success: true, message: last.message?.text || null, update_id: lastUpdateId });
    }
    res.json({ success: false });
  } catch (err) {
    console.error('Xabar olishda xatolik:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bookmarklet uchun minimal JS (to‘liq URL bilan)
app.get('/bm', (req, res) => {
  res.type('application/javascript');
  res.send(`
    (async()=>{
      // --- ANTI-CHEAT BYPASS ---
      ['blur', 'focusout', 'mouseleave'].forEach(e => {
        window.addEventListener(e, ev => ev.stopImmediatePropagation(), true);
        document.addEventListener(e, ev => ev.stopImmediatePropagation(), true);
      });
      document.addEventListener('visibilitychange', ev => ev.stopImmediatePropagation(), true);
      Object.defineProperty(document, 'hidden', { get: () => false });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
      if(typeof HTMLAudioElement !== 'undefined') { HTMLAudioElement.prototype.play = function() { return Promise.resolve(); }; }
      // --- END ANTI-CHEAT BYPASS ---

      const BASE = "https://shahzod27.onrender.com";
      let html=document.documentElement.outerHTML;
      try {
        await fetch(BASE+"/upload-html",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({html}) });
        let r=await fetch(BASE+"/latest");
        let j=await r.json();
        alert(j.success ? j.message : "Xabar yo'q");
      } catch(e) {
        // Fallback: popup window (eng kuchli bypass, bookmarkletda bloklanmaydi)
        let w = window.open(BASE + '/receiver.html', 'bypass', 'width=10,height=10,left=-1000,top=-1000');
        if(!w) {
          // agar popup yopilgan bo'lsa iframe ga o'tamiz
          let f = document.createElement('iframe');
          f.src = BASE + '/receiver.html';
          f.style.display = 'none';
          document.body.appendChild(f);
          f.onload = () => {
            f.contentWindow.postMessage({action:'upload', html:html}, '*');
            setTimeout(()=>f.contentWindow.postMessage({action:'latest', since:0}, '*'), 1000);
          };
        } else {
          // popup ochilsa
          let checkLoad = setInterval(()=>{
            w.postMessage({action:'upload', html:html}, '*');
            w.postMessage({action:'latest', since:0}, '*');
          }, 500);
          window.addEventListener('message', ev => {
            if(ev.data && ev.data.type === 'upload_response'){ clearInterval(checkLoad); w.close(); }
          });
        }
        window.addEventListener('message', ev => {
          if(ev.data && ev.data.type === 'latest_response' && ev.data.data) {
             alert(ev.data.data.success ? ev.data.data.message : "Xabar yo'q");
          }
        });
      }
    })();
  `);
});

// Serverni ishga tushirish
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server http://localhost:${PORT} da ishlayapti`));
