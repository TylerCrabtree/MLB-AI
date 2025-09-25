const mainLog = document.getElementById("mainLog");
const userInput = document.getElementById("userInput");
const termStatus = document.getElementById("termStatus");
const leftTextEl = document.getElementById("leftBannerText");
const rightTextEl = document.getElementById("rightBannerText");

const ghostFeed = document.getElementById('ghostFeed');
const asciiMirror = document.getElementById('asciiMirror');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const asciiChars = " .:-=+*#%@";

let headerHTML = "";
let currentQueryId = 0; // increments for each query

// =====================
// utils
// =====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function appendMain(text, delay = 18, queryId = null) {
  for (let ch of text + "\n") {
    if (queryId !== null && queryId !== currentQueryId) return; // stop if query canceled
    mainLog.textContent += ch;
    mainLog.scrollTop = mainLog.scrollHeight;
    await sleep(delay);
  }
}

async function typeLine(line, delay = 30, queryId = null) {
  const cursor = "▋";
  let buffer = "";
  for (let ch of line) {
    if (queryId !== null && queryId !== currentQueryId) return;
    buffer += ch;
    mainLog.textContent = headerHTML + "\n\n" + buffer + cursor;
    mainLog.scrollTop = mainLog.scrollHeight;
    await sleep(delay + Math.random() * 30);
  }
  if (queryId === null || queryId === currentQueryId) {
    mainLog.textContent = headerHTML + "\n\n" + buffer + "\n";
    mainLog.scrollTop = mainLog.scrollHeight;
  }
}

// banner typing
async function typeBanner(el, text, speed = 80) {
  el.textContent = "";
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await sleep(speed);
  }
}
async function playBannerText() {
  const leftLines = ["MLB AI", "Tracking 1200+ players", "Analyzing trends...", "Ready for your query..."];
  const rightLines = ["Search player info", "Pitch metrics online", "Stats ready", "Query initialized"];

  for (let i = 0; i < leftLines.length; i++) {
    await typeBanner(leftTextEl, leftLines[i]);
    await sleep(1200);
  }
  for (let i = 0; i < rightLines.length; i++) {
    await typeBanner(rightTextEl, rightLines[i]);
    await sleep(1200);
  }
}

// =====================
// ASCII ghost
// =====================
function startGhost() {
  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    ghostFeed.srcObject = stream;
    ghostFeed.addEventListener("playing", () => {
      canvas.width = 80;
      canvas.height = 60;
      setInterval(drawASCII, 900);
    });
  });
}
asciiMirror.style.opacity = 0;
function drawASCII() {
  try {
    ctx.drawImage(ghostFeed, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let ascii = "";
    for (let y = 0; y < imgData.height; y += 2) {
      for (let x = 0; x < imgData.width; x++) {
        const i = (y * imgData.width + x) * 4;
        const avg = (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
        const char = asciiChars[Math.floor((avg / 255) * (asciiChars.length - 1))];
        ascii += char;
      }
      ascii += "\n";
    }
    asciiMirror.textContent = ascii;
    asciiMirror.style.opacity = 1;
  } catch (e) { }
}

// =====================
// Wikipedia lookup
// =====================
async function queryMLB(text, queryId) {
  termStatus.textContent = "Searching...";
  await typeLine(`> ${text}`, 30, queryId);

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(text)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (queryId !== currentQueryId) return;

    if (!searchData.query.search.length) {
      await appendMain("⚠ No Wikipedia results found.", 18, queryId);
      termStatus.textContent = "Idle";
      return;
    }

    const topTitle = searchData.query.search[0].title;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
    const res = await fetch(summaryUrl);
    const data = await res.json();
    if (queryId !== currentQueryId) return;

    if (data.extract) {
      await appendMain(`📖 ${data.title}`, 18, queryId);
      await appendMain(data.extract, 18, queryId);
      if (data.content_urls?.desktop?.page) {
        await appendMain(`🔗 More: ${data.content_urls.desktop.page}`, 18, queryId);
      }
    } else {
      await appendMain("⚠ No summary found on Wikipedia.", 18, queryId);
    }

    // === stats parse ===
    const htmlUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(topTitle)}`;
    const htmlRes = await fetch(htmlUrl);
    const htmlText = await htmlRes.text();
    if (queryId !== currentQueryId) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    let statsOutput = "";
    const infobox = doc.querySelector("table.infobox");
    if (infobox) {
      const rows = infobox.querySelectorAll("tr");
      rows.forEach(row => {
        const th = row.querySelector("th");
        const td = row.querySelector("td");
        if (th && td) {
          const label = th.textContent.trim();
          const value = td.textContent.trim();
          if (["Win–loss record", "Earned run average", "Strikeouts", "Batting average", "Home runs", "Runs batted in"].some(k => label.includes(k))) {
            statsOutput += `${label}: ${value}\n`;
          }
        }
      });
    }
    if (statsOutput) {
      await appendMain(`📊 Stats:\n${statsOutput.trim()}`, 18, queryId);
    }

  } catch (err) {
    if (queryId === currentQueryId) {
      await appendMain("❌ Error fetching Wikipedia data.", 18, queryId);
      console.error(err);
    }
  }

  if (queryId === currentQueryId) {
    termStatus.textContent = "Idle";
  }
}

// =====================
// Input handler
// =====================
userInput.addEventListener("keydown", async e => {
  if (e.key === "Enter" && userInput.value.trim()) {
    currentQueryId++; // cancel previous queries
    mainLog.textContent = headerHTML + "\n\n"; // clear old log
    document.getElementById("logContainer").scrollTop = document.getElementById("logContainer").scrollHeight;

    queryMLB(userInput.value.trim(), currentQueryId);
    userInput.value = "";
  }
});

// =====================
// Init
// =====================
(async function init(){
  await appendMain("Initializing MLB AI...");
  await appendMain("System booted. Awaiting input.");
  headerHTML = mainLog.textContent.trim();
  playBannerText();
  startGhost();
})();
