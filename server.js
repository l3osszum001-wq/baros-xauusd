const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// แปลงเวลาเป็นเวลาไทย (GMT+7)
function convertToThaiTime(dateStr, timeStr) {
  if (!timeStr || timeStr.toLowerCase().includes('all day') || timeStr.toLowerCase().includes('day')) return 'ตลอดวัน';
  let [time, modifier] = timeStr.split(/(am|pm)/i);
  if (!modifier) return timeStr;
  let [hours, minutes] = time.split(':').map(Number);
  if (isNaN(minutes)) minutes = 0;
  if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
  if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
  
  // แปลง UTC/EST ของ Forex Factory เป็นเวลาไทย (+7 หรือ +11/12 ชดเชยเวลา)
  let thaiHours = (hours + 11) % 24;
  return `${String(thaiHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} น.`;
}

app.get('/api/gold-signals', async (req, res) => {
  const timeframe = req.query.timeframe || 'this';
  
  // เลือก URL API สำรองที่เสถียรที่สุด
  let apiUrl = 'https://nfp.ourfxbook.com/fetch.php?do=calendar&week=this';
  if (timeframe === 'next') {
    apiUrl = 'https://nfp.ourfxbook.com/fetch.php?do=calendar&week=next';
  }

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 8000
    });

    let events = [];
    if (Array.isArray(response.data)) {
      events = response.data;
    } else if (response.data && typeof response.data === 'object') {
      events = Object.values(response.data);
    }

    // กรองเฉพาะข่าว USD ที่มี Impact สูง (กล่องแดง / High / High Impact)
    const usdHighEvents = events.filter(e => {
      const country = (e.country || e.currency || '').toUpperCase();
      const impact = (e.impact || '').toLowerCase();
      return country === 'USD' && (impact === 'high' || impact === 'red' || impact === '3');
    });

    const signals = usdHighEvents.map(event => {
      const title = event.title || event.name || 'USD News Event';
      const isInverse = title.toLowerCase().includes('unemployment claims');
      let impactOnGold = "";
      let direction = "UPCOMING";
      let status = "PENDING";

      const actualVal = event.actual || '';
      const forecastVal = event.forecast || 'รออัปเดต';

      if (actualVal && actualVal.trim() !== '' && actualVal !== 'รอผล') {
        status = "DONE";
        const actualNum = parseFloat(actualVal.replace(/[^0-9.-]/g, ''));
        const forecastNum = parseFloat(forecastVal.replace(/[^0-9.-]/g, ''));

        if (!isNaN(actualNum) && !isNaN(forecastNum)) {
          const isUsdStrong = isInverse ? actualNum < forecastNum : actualNum > forecastNum;
          if (isUsdStrong) {
            impactOnGold = `ผลจริง (${actualVal}): USD แข็งค่า ➔ **กดดันทองคำร่วงลง**`;
            direction = "DOWN (SELL)";
          } else {
            impactOnGold = `ผลจริง (${actualVal}): USD อ่อนค่า ➔ **หนุนทองคำดีดตัวขึ้น**`;
            direction = "UP (BUY)";
          }
        } else {
          impactOnGold = `ผลจริงออกแล้ว: ${actualVal}`;
          direction = "RELEASED";
        }
      } else {
        status = "PENDING";
        if (isInverse) {
          impactOnGold = `📊 <b>วิเคราะห์ฉากทัศน์ (คาดการณ์: ${forecastVal}):</b><br>` +
            `• ตัวเลขจริง <b>> ${forecastVal}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY)</b><br>` +
            `• ตัวเลขจริง <b>< ${forecastVal}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL)</b>`;
        } else {
          impactOnGold = `📊 <b>วิเคราะห์ฉากทัศน์ (คาดการณ์: ${forecastVal}):</b><br>` +
            `• ตัวเลขจริง <b>> ${forecastVal}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL)</b><br>` +
            `• ตัวเลขจริง <b>< ${forecastVal}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY)</b>`;
        }
        direction = "UPCOMING NEWS";
      }

      return {
        title: title,
        date: event.date || '',
        time: event.time || '',
        thaiTime: convertToThaiTime(event.date, event.time),
        forecast: forecastVal,
        previous: event.previous || '-',
        actual: actualVal || 'รอผล',
        signal: direction,
        analysis: impactOnGold,
        status: status
      };
    });

    res.json(signals);
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลข่าวได้' });
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
        .card { background: #1e293b; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 5px solid #64748b; }
        .buy { border-left-color: #22c55e; }
        .sell { border-left-color: #ef4444; }
        .pending { border-left-color: #ef4444; }
        .header-box { display: flex; flex-direction: column; gap: 8px; }
        @media(min-width: 600px) { .header-box { flex-direction: row; justify-content: space-between; align-items: center; } }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8em; align-self: flex-start; }
        .badge-buy { background: #166534; color: #4ade80; }
        .badge-sell { background: #991b1b; color: #fca5a5; }
        .badge-pending { background: #b91c1c; color: #fca5a5; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; background: #0f172a; padding: 10px; border-radius: 8px; font-size: 0.85rem; }
        @media(min-width: 768px) { .grid { grid-template-columns: repeat(4, 1fr); } }
      </style>
    </head>
    <body>
      <h1>🏆 Live Gold Signals</h1>
      <div class="subtitle">Forex Factory High Impact News (USD)</div>
      
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
          container.innerHTML = '<p style="text-align:center; padding: 30px; color:#94a3b8;">กำลังดึงข้อมูลข่าวจาก Forex Factory...</p>';

          fetch('/api/gold-signals?timeframe=' + timeframe)
            .then(res => res.json())
            .then(data => {
              container.innerHTML = '';
              if(!data || !data.length) {
                container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">ช่วงเวลานี้ไม่มีข่าว USD กล่องแดง</p>';
                return;
              }
              data.forEach(item => {
                let cardClass = item.status === 'PENDING' ? 'pending' : (item.signal.includes('BUY') ? 'buy' : 'sell');
                let badgeClass = item.status === 'PENDING' ? 'badge-pending' : (item.signal.includes('BUY') ? 'badge-buy' : 'badge-sell');
                
                container.innerHTML += \`
                  <div class="card \${cardClass}">
                    <div class="header-box">
                      <h3 style="margin:0; font-size: 1.05rem;">🟥 \${item.title} <br><span style="color: #f59e0b; font-size: 0.9rem;">(\${item.date} - \${item.thaiTime})</span></h3>
                      <span class="badge \${badgeClass}">\${item.signal}</span>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9rem; line-height: 1.5; color: #e2e8f0;">\${item.analysis}</div>
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
              container.innerHTML = '<p style="text-align:center; color:#ef4444; padding:30px;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
            });
        }
        loadNews('this');
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
