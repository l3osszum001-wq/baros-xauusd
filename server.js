const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// แปลงเวลา Forex Factory ให้เป็นเวลาประเทศไทย (GMT+7)
function formatThaiTime(dateStr, timeStr) {
  if (!timeStr || timeStr.toLowerCase().includes('all day') || timeStr.toLowerCase().includes('day')) {
    return 'ตลอดวัน';
  }
  
  // แปลงเวลารูปแบบ "8:30am" หรือ "1:30pm"
  const match = timeStr.match(/(\d+):(\d+)(am|pm)/i);
  if (!match) return timeStr;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const modifier = match[3].toLowerCase();

  if (modifier === 'pm' && hours < 12) hours += 12;
  if (modifier === 'am' && hours === 12) hours = 0;

  // Forex Factory Feed เวลาตั้งต้นมักเป็น EST (UTC-4/-5) หรือ UTC 
  // ปรับชดเชยเข้าเวลาไทย (+11 ชั่วโมงสำหรับ EST ในช่วง Summer หรือตามมาตรฐาน)
  let thaiHours = (hours + 11) % 24;
  return `${String(thaiHours).padStart(2, '0')}:${minutes} น.`;
}

app.get('/api/gold-signals', async (req, res) => {
  const timeframe = req.query.timeframe || 'this';
  const url = `https://nfp.ourfxbook.com/fetch.php?do=calendar&week=${timeframe}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 8000
    });

    let rawEvents = [];
    if (Array.isArray(response.data)) {
      rawEvents = response.data;
    } else if (response.data && typeof response.data === 'object') {
      rawEvents = Object.values(response.data);
    }

    // กรองเฉพาะข่าว USD ที่มี Impact สูง (กล่องแดง / High Impact)
    const filteredEvents = rawEvents.filter(event => {
      const country = (event.country || event.currency || '').toUpperCase();
      const impact = (event.impact || '').toLowerCase();
      return country === 'USD' && (impact === 'high' || impact === 'red' || impact === '3');
    });

    const results = filteredEvents.map(event => {
      const title = event.title || event.name || 'USD News Event';
      const forecastVal = event.forecast || 'รออัปเดต';
      const actualVal = event.actual || 'รอผล';
      const isInverse = title.toLowerCase().includes('unemployment claims');

      let analysis = "";
      let signal = "UPCOMING NEWS";
      let status = "PENDING";

      if (actualVal && actualVal !== 'รอผล' && actualVal.trim() !== '') {
        status = "DONE";
        const actNum = parseFloat(actualVal.replace(/[^0-9.-]/g, ''));
        const fcNum = parseFloat(forecastVal.replace(/[^0-9.-]/g, ''));

        if (!isNaN(actNum) && !isNaN(fcNum)) {
          const isUsdStrong = isInverse ? actNum < fcNum : actNum > fcNum;
          if (isUsdStrong) {
            analysis = `ผลจริง (<b>${actualVal}</b>): USD แข็งค่า ➔ <b>ทองคำมีโอกาสทุบลง (SELL) 📉</b>`;
            signal = "SELL";
          } else {
            analysis = `ผลจริง (<b>${actualVal}</b>): USD อ่อนค่า ➔ <b>ทองคำมีโอกาสดีดขึ้น (BUY) 📈</b>`;
            signal = "BUY";
          }
        } else {
          analysis = `ผลจริงออกแล้ว: <b>${actualVal}</b>`;
          signal = "RELEASED";
        }
      } else {
        if (isInverse) {
          analysis = `📊 <b>วิเคราะห์ (คาดการณ์: ${forecastVal}):</b><br>` +
            `• ตัวเลขจริง <b>> ${forecastVal}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY) 📈</b><br>` +
            `• ตัวเลขจริง <b>< ${forecastVal}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL) 📉</b>`;
        } else {
          analysis = `📊 <b>วิเคราะห์ (คาดการณ์: ${forecastVal}):</b><br>` +
            `• ตัวเลขจริง <b>> ${forecastVal}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL) 📉</b><br>` +
            `• ตัวเลขจริง <b>< ${forecastVal}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY) 📈</b>`;
        }
      }

      return {
        title: title,
        date: event.date || '',
        time: event.time || '',
        thaiTime: formatThaiTime(event.date, event.time),
        forecast: forecastVal,
        previous: event.previous || '-',
        actual: actualVal,
        signal: signal,
        analysis: analysis,
        status: status
      };
    });

    res.json(results);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'ไม่สามารถเชื่อมต่อ Forex Factory Feed ได้' });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Forex Factory Gold Signals</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 15px; }
        h1 { color: #f59e0b; text-align: center; font-size: 1.5rem; margin-top: 10px; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #94a3b8; font-size: 0.85rem; margin-bottom: 15px; }
        .controls { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
        .btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
        .btn.active { background: #f59e0b; color: #0f172a; border-color: #f59e0b; }
        .card { background: #1e293b; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 5px solid #ef4444; }
        .card.buy { border-left-color: #22c55e; }
        .card.sell { border-left-color: #ef4444; }
        .header-box { display: flex; flex-direction: column; gap: 8px; }
        @media(min-width: 600px) { .header-box { flex-direction: row; justify-content: space-between; align-items: center; } }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8em; align-self: flex-start; background: #991b1b; color: #fca5a5; }
        .badge-buy { background: #166534; color: #4ade80; }
        .badge-sell { background: #991b1b; color: #fca5a5; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; background: #0f172a; padding: 10px; border-radius: 8px; font-size: 0.85rem; }
        @media(min-width: 768px) { .grid { grid-template-columns: repeat(4, 1fr); } }
      </style>
    </head>
    <body>
      <h1>🏆 Live Gold Signals</h1>
      <div class="subtitle">Forex Factory High Impact News (USD กล่องแดง)</div>
      
      <div class="controls">
        <button class="btn active" onclick="loadNews('this', this)">สัปดาห์นี้</button>
        <button class="btn" onclick="loadNews('next', this)">สัปดาห์หน้า</button>
      </div>

      <div id="news-container">กำลังดึงข้อมูล...</div>

      <script>
        function loadNews(timeframe, btnElement) {
          if(btnElement) {
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btnElement.classList.add('active');
          }
          const container = document.getElementById('news-container');
          container.innerHTML = '<p style="text-align:center; padding: 30px; color:#94a3b8;">กำลังดึงรายการข่าวเรียลไทม์จาก Forex Factory...</p>';

          fetch('/api/gold-signals?timeframe=' + timeframe)
            .then(res => res.json())
            .then(data => {
              container.innerHTML = '';
              if(!data || !data.length) {
                container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">ช่วงเวลานี้ไม่มีข่าว USD กล่องแดงใน Forex Factory</p>';
                return;
              }
              data.forEach(item => {
                let cardClass = item.signal === 'BUY' ? 'buy' : (item.signal === 'SELL' ? 'sell' : '');
                let badgeClass = item.signal === 'BUY' ? 'badge-buy' : (item.signal === 'SELL' ? 'badge-sell' : 'badge');
                
                container.innerHTML += \`
                  <div class="card \${cardClass}">
                    <div class="header-box">
                      <h3 style="margin:0; font-size: 1.05rem;">🟥 \${item.title} <br><span style="color: #f59e0b; font-size: 0.85rem;">(\${item.date} - \${item.thaiTime})</span></h3>
                      <span class="badge \${badgeClass}">\${item.signal}</span>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9rem; line-height: 1.6; color: #e2e8f0;">\${item.analysis}</div>
                    <div class="grid">
                      <div>คาดการณ์: <strong>\${item.forecast}</strong></div>
                      <div>ครั้งก่อน: <strong>\${item.previous}</strong></div>
                      <div>ตัวเลขจริง: <strong style="color:#f59e0b;">\${item.actual}</strong></div>
                      <div>ระดับ: <strong style="color:#ef4444;">HIGH (กล่องแดง)</strong></div>
                    </div>
                  </div>
                \`;
              });
            })
            .catch(() => {
              container.innerHTML = '<p style="text-align:center; color:#ef4444; padding:30px;">ไม่สามารถดึงข้อมูลข่าวได้ กรุณาลองใหม่อีกครั้ง</p>';
            });
        }
        loadNews('this');
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
