const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// โค้ดสำรองข่าว USD กล่องแดงสำคัญเมื่อ Feed หลักถูกบล็อก
const mockNewsThisWeek = [
  { title: 'CPI m/m (ดัชนีราคาผู้บริโภค)', date: 'Sep 15', time: '19:30', thaiTime: '19:30 น.', forecast: '0.2%', previous: '0.2%', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: false },
  { title: 'Core CPI m/m', date: 'Sep 15', time: '19:30', thaiTime: '19:30 น.', forecast: '0.3%', previous: '0.2%', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: false },
  { title: 'Retail Sales m/m (ยอดค้าปลีก)', date: 'Sep 16', time: '19:30', thaiTime: '19:30 น.', forecast: '0.4%', previous: '0.4%', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: false },
  { title: 'Unemployment Claims (จำนวนผู้ขอรับสวัสดิการว่างงาน)', date: 'Sep 17', time: '19:30', thaiTime: '19:30 น.', forecast: '230K', previous: '231K', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: true },
  { title: 'FOMC Federal Funds Rate (อัตราดอกเบี้ยนโยบาย)', date: 'Sep 18', time: '01:00', thaiTime: '01:00 น.', forecast: '5.25%', previous: '5.50%', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: true }
];

const mockNewsNextWeek = [
  { title: 'Flash Manufacturing PMI', date: 'Sep 22', time: '20:45', thaiTime: '20:45 น.', forecast: '49.5', previous: '49.6', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: false },
  { title: 'Final GDP q/q (ประมาณการเติบโตทางเศรษฐกิจ)', date: 'Sep 25', time: '19:30', thaiTime: '19:30 น.', forecast: '3.0%', previous: '3.0%', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: false },
  { title: 'Core PCE Price Index m/m (ดัชนีเงินเฟ้อ PCE)', date: 'Sep 26', time: '19:30', thaiTime: '19:30 น.', forecast: '0.2%', previous: '0.2%', actual: 'รอผล', signal: 'UPCOMING NEWS', isInverse: false }
];

function buildAnalysis(event) {
  const fcText = event.forecast || 'รออัปเดต';
  if (event.actual && event.actual !== 'รอผล' && event.actual.trim() !== '') {
    return `ผลจริงออกแล้ว: <b>${event.actual}</b> (คาดการณ์: ${fcText})`;
  }
  if (event.isInverse) {
    return `📊 <b>วิเคราะห์ฉากทัศน์ (คาดการณ์: ${fcText}):</b><br>` +
      `• ตัวเลขจริง <b>> ${fcText}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY) 📈</b><br>` +
      `• ตัวเลขจริง <b>< ${fcText}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL) 📉</b>`;
  }
  return `📊 <b>วิเคราะห์ฉากทัศน์ (คาดการณ์: ${fcText}):</b><br>` +
    `• ตัวเลขจริง <b>> ${fcText}</b> (ดีต่อ USD) ➔ ทองคำมีโอกาส <b>ทุบลง (SELL) 📉</b><br>` +
    `• ตัวเลขจริง <b>< ${fcText}</b> (แย่ต่อ USD) ➔ ทองคำมีโอกาส <b>ดีดขึ้น (BUY) 📈</b>`;
}

app.get('/api/gold-signals', async (req, res) => {
  const timeframe = req.query.timeframe || 'this';
  let fetchedEvents = [];

  try {
    const response = await axios.get('https://nfp.ourfxbook.com/fetch.php?do=calendar&week=' + timeframe, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    if (Array.isArray(response.data) && response.data.length > 0) {
      const usdEvents = response.data.filter(e => {
        const c = (e.country || e.currency || '').toUpperCase();
        const imp = (e.impact || '').toLowerCase();
        return c === 'USD' && (imp === 'high' || imp === 'red' || imp === '3');
      });

      fetchedEvents = usdEvents.map(e => ({
        title: e.title || e.name || 'USD Event',
        date: e.date || '',
        time: e.time || '',
        thaiTime: e.time || 'ตามตาราง',
        forecast: e.forecast || 'รออัปเดต',
        previous: e.previous || '-',
        actual: e.actual || 'รอผล',
        signal: 'UPCOMING NEWS',
        isInverse: (e.title || '').toLowerCase().includes('unemployment claims')
      }));
    }
  } catch (err) {
    console.log('API External error, loading backup news feed...');
  }

  // หากดึงไม่ได้ ให้แสดงตารางข่าวสำรอง (Fallback Data)
  if (fetchedEvents.length === 0) {
    fetchedEvents = timeframe === 'next' ? mockNewsNextWeek : mockNewsThisWeek;
  }

  const result = fetchedEvents.map(item => ({
    ...item,
    analysis: buildAnalysis(item),
    status: item.actual && item.actual !== 'รอผล' ? 'DONE' : 'PENDING'
  }));

  res.json(result);
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
        .header-box { display: flex; flex-direction: column; gap: 8px; }
        @media(min-width: 600px) { .header-box { flex-direction: row; justify-content: space-between; align-items: center; } }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.8em; align-self: flex-start; background: #991b1b; color: #fca5a5; }
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
          container.innerHTML = '<p style="text-align:center; padding: 30px; color:#94a3b8;">กำลังดึงรายการข่าว USD กล่องแดง...</p>';

          fetch('/api/gold-signals?timeframe=' + timeframe)
            .then(res => res.json())
            .then(data => {
              container.innerHTML = '';
              if(!data || !data.length) {
                container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">ไม่มีข้อมูลข่าวช่วงเวลานี้</p>';
                return;
              }
              data.forEach(item => {
                container.innerHTML += \`
                  <div class="card">
                    <div class="header-box">
                      <h3 style="margin:0; font-size: 1.05rem;">🟥 \${item.title} <br><span style="color: #f59e0b; font-size: 0.85rem;">(\${item.date} - \${item.thaiTime})</span></h3>
                      <span class="badge">\${item.signal}</span>
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
