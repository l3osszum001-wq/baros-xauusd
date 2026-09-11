const express = require('express');
const axios = require('axios');
const app = express();

// ใช้ Port จาก Cloud Provider หรือใช้ 3000 สำหรับเปิดในคอม
const PORT = process.env.PORT || 3000;

function convertToThaiTime(timeStr) {
  if (!timeStr || (!timeStr.includes('am') && !timeStr.includes('pm'))) return timeStr || 'ตลอดวัน';
  let [time, modifier] = timeStr.split(/(am|pm)/i);
  let [hours, minutes] = time.split(':').map(Number);
  if (!minutes) minutes = 0;

  if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
  if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

  let thaiHours = (hours + 11) % 24;
  return `${String(thaiHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} น.`;
}

app.get('/api/gold-signals', async (req, res) => {
  try {
    const response = await axios.get('https://nfp.forexfactory.com/fetch.php?do=calendar&week=this', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    const events = response.data;
    const usdHighImpactEvents = events.filter(e => e.country === 'USD' && e.impact === 'High');

    const signals = usdHighImpactEvents.map(event => {
      const isInverse = event.title.toLowerCase().includes('unemployment claims');
      let impactOnGold = "";
      let direction = "UPCOMING";
      let status = "PENDING";

      if (event.actual && event.forecast) {
        status = "DONE";
        const actual = parseFloat(event.actual.replace(/[^0-9.-]/g, ''));
        const forecast = parseFloat(event.forecast.replace(/[^0-9.-]/g, ''));

        if (!isNaN(actual) && !isNaN(forecast)) {
          const isUsdStrong = isInverse ? actual < forecast : actual > forecast;
          if (isUsdStrong) {
            impactOnGold = `ผลจริง (${event.actual}): USD แข็งค่า ➔ **กดดันทองคำร่วงลง**`;
            direction = "DOWN (SELL)";
          } else {
            impactOnGold = `ผลจริง (${event.actual}): USD อ่อนค่า ➔ **หนุนทองคำดีดตัวขึ้น**`;
            direction = "UP (BUY)";
          }
        }
      } else {
        status = "PENDING";
        const fcText = event.forecast || 'รออัปเดต';
        if (isInverse) {
          impactOnGold = `📊 <b>วิเคราะห์ฉากทัศน์ (คาดการณ์: ${fcText}):</b><br>` +
            `• ตัวเลขจริง <b>> ${fcText}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY)</b><br>` +
            `• ตัวเลขจริง <b>< ${fcText}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL)</b>`;
        } else {
          impactOnGold = `📊 <b>วิเคราะห์ฉากทัศน์ (คาดการณ์: ${fcText}):</b><br>` +
            `• ตัวเลขจริง <b>> ${fcText}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL)</b><br>` +
            `• ตัวเลขจริง <b>< ${fcText}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY)</b>`;
        }
        direction = "UPCOMING NEWS";
      }

      return {
        title: event.title,
        date: event.date,
        time: event.time,
        thaiTime: convertToThaiTime(event.time),
        forecast: event.forecast || 'รออัปเดต',
        previous: event.previous || '-',
        actual: event.actual || 'รอผล',
        signal: direction,
        analysis: impactOnGold,
        status: status
      };
    });

    res.json(signals);
  } catch (error) {
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูล Forex Factory ได้' });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <!-- ตั้งค่า Viewport เพื่อให้รองรับ iPhone / iPad / Mobile 100% -->
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Forex Factory Gold Signals</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 15px; }
        h1 { color: #f59e0b; text-align: center; font-size: 1.5rem; margin-top: 10px; }
        .subtitle { text-align: center; color: #94a3b8; font-size: 0.85rem; margin-bottom: 20px; }
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
        
        /* Grid สำหรับแสดงผลบนมือถือและแท็บเล็ต */
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; background: #0f172a; padding: 10px; border-radius: 8px; font-size: 0.85rem; }
        @media(min-width: 768px) { .grid { grid-template-columns: repeat(4, 1fr); } }
      </style>
    </head>
    <body>
      <h1>🏆 Live Gold Signals</h1>
      <div class="subtitle">Forex Factory High Impact News (USD)</div>
      <div id="news-container">กำลังดึงข้อมูล...</div>

      <script>
        fetch('/api/gold-signals')
          .then(res => res.json())
          .then(data => {
            const container = document.getElementById('news-container');
            container.innerHTML = '';
            if(!data || !data.length) {
              container.innerHTML = '<p style="text-align:center;">สัปดาห์นี้ไม่มีข่าว USD กล่องแดง</p>';
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
                    <div>ระดับ: <strong style="color:#ef4444;">HIGH</strong></div>
                  </div>
                </div>
              \`;
            });
          });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));