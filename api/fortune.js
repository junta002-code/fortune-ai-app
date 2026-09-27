const ZODIAC = {
  "おひつじ座": 0,
  "おうし座": 30,
  "ふたご座": 60,
  "かに座": 90,
  "しし座": 120,
  "おとめ座": 150,
  "てんびん座": 180,
  "さそり座": 210,
  "いて座": 240,
  "やぎ座": 270,
  "みずがめ座": 300,
  "うお座": 330
};

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

function angularDistance(a, b) {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, 360 - d);
}

function sinDeg(deg) {
  return Math.sin(deg * Math.PI / 180);
}

function cosDeg(deg) {
  return Math.cos(deg * Math.PI / 180);
}

function atan2Deg(y, x) {
  return Math.atan2(y, x) * 180 / Math.PI;
}

// 外部の天文ライブラリを使わず、太陽・月の黄経を近似計算する。
// 今回の占い用途では、日々の位置関係を安定して取得することを優先する。
function getSunMoonLongitude(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451543.5;

  // 太陽
  const sunW = 282.9404 + 0.0000470935 * d;
  const sunM = 356.0470 + 0.9856002585 * d;
  const sunEcc = 0.016709 - 0.000000001151 * d;
  const sunE = sunM + (180 / Math.PI) * sunEcc * sinDeg(sunM) * (1 + sunEcc * cosDeg(sunM));
  const sunX = cosDeg(sunE) - sunEcc;
  const sunY = Math.sqrt(1 - sunEcc * sunEcc) * sinDeg(sunE);
  const sunV = atan2Deg(sunY, sunX);
  const sunLongitude = normalizeAngle(sunV + sunW);

  // 月の軌道要素
  const moonN = 125.1228 - 0.0529538083 * d;
  const moonI = 5.1454;
  const moonW = 318.0634 + 0.1643573223 * d;
  const moonA = 60.2666;
  const moonEcc = 0.0549;
  const moonM = 115.3654 + 13.0649929509 * d;

  const sunLongitudeMean = normalizeAngle(sunM + sunW);
  const moonLongitudeMean = normalizeAngle(moonM + moonW);

  // 月の主要な摂動を簡易的に反映
  const ev = 1.2739 * sinDeg(2 * (moonLongitudeMean - sunLongitudeMean) - moonM);
  const ae = 0.1858 * sinDeg(sunM);
  const a3 = 0.37 * sinDeg(sunM);
  const moonM1 = moonM + ev - ae - a3;
  const ec = 6.2886 * sinDeg(moonM1);
  const a4 = 0.214 * sinDeg(2 * moonM1);
  const a5 = 0.11 * sinDeg(moonLongitudeMean - sunLongitudeMean);
  const moonM2 = moonM1 + ec - a4 + a5;

  const moonE = moonM2 + (180 / Math.PI) * moonEcc * sinDeg(moonM2) * (1 + moonEcc * cosDeg(moonM2));
  const moonR = moonA * (1 - moonEcc * cosDeg(moonE));
  const moonV = atan2Deg(
    Math.sqrt(1 - moonEcc * moonEcc) * sinDeg(moonE),
    cosDeg(moonE) - moonEcc
  );

  const u = moonW + moonV;
  const nRad = moonN * Math.PI / 180;
  const iRad = moonI * Math.PI / 180;
  const uRad = u * Math.PI / 180;

  const xh = moonR * (Math.cos(nRad) * Math.cos(uRad) - Math.sin(nRad) * Math.sin(uRad) * Math.cos(iRad));
  const yh = moonR * (Math.sin(nRad) * Math.cos(uRad) + Math.cos(nRad) * Math.sin(uRad) * Math.cos(iRad));

  let moonLongitude = normalizeAngle(atan2Deg(yh, xh));

  // 主要な追加補正
  moonLongitude +=
    -0.17 * sinDeg(moonN)
    -0.34 * sinDeg(2 * moonLongitudeMean - 2 * sunLongitudeMean)
    +0.66 * sinDeg(2 * moonLongitudeMean);

  moonLongitude = normalizeAngle(moonLongitude);

  return {
    sunLongitude,
    moonLongitude
  };
}

// 太陽・月と選択星座の位置関係だけで内部的な傾向を作る。
// これは占いのルールであり、科学的な因果関係を示すものではない。
function interpolateAspectScore(distance) {
  const points = [
    { angle: 0, score: 80 }, { angle: 30, score: 65 }, { angle: 60, score: 90 },
    { angle: 90, score: 40 }, { angle: 120, score: 100 }, { angle: 150, score: 35 },
    { angle: 180, score: 25 }
  ];
  const d = Math.min(180, Math.max(0, distance));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (d >= a.angle && d <= b.angle) {
      const ratio = (d - a.angle) / (b.angle - a.angle);
      return a.score + (b.score - a.score) * ratio;
    }
  }
  return 25;
}

function buildZodiacSkyData(zodiac, date) {
  const signStart = ZODIAC[zodiac];
  const signCenter = normalizeAngle(signStart + 15);
  const { sunLongitude, moonLongitude } = getSunMoonLongitude(date);

  const sunDistance = angularDistance(sunLongitude, signCenter);
  const moonDistance = angularDistance(moonLongitude, signCenter);

  const sunScore = interpolateAspectScore(sunDistance);
  const moonScore = interpolateAspectScore(moonDistance);
  const sunMoonDistance = angularDistance(sunLongitude, moonLongitude);
  const sunMoonScore = interpolateAspectScore(sunMoonDistance);
  const skyScore = Math.round(sunScore * 0.40 + moonScore * 0.35 + sunMoonScore * 0.25);
  const zodiacPoints = Math.max(1, Math.min(30, Math.round(skyScore * 0.30)));

  let tendency;
  if (skyScore >= 8) tendency = "追い風";
  else if (skyScore >= 2) tendency = "やや追い風";
  else if (skyScore <= -8) tendency = "慎重";
  else if (skyScore <= -2) tendency = "やや慎重";
  else tendency = "穏やか";

  return {
    zodiac,
    sunLongitude: Number(sunLongitude.toFixed(2)),
    moonLongitude: Number(moonLongitude.toFixed(2)),
    zodiacCenterLongitude: Number(signCenter.toFixed(2)),
    sunDistance: Number(sunDistance.toFixed(2)),
    moonDistance: Number(moonDistance.toFixed(2)),
    sunMoonDistance: Number(sunMoonDistance.toFixed(2)),
    sunScore: Number(sunScore.toFixed(1)),
    moonScore: Number(moonScore.toFixed(1)),
    sunMoonScore: Number(sunMoonScore.toFixed(1)),
    skyScore,
    zodiacPoints,
    tendency
  };
}

const LUCKY_COLORS = [
  { name: "青", traits: ["調和", "安定", "集中"] }, { name: "緑", traits: ["調和", "安定", "自然"] },
  { name: "白", traits: ["調和", "安定", "純粋"] }, { name: "水色", traits: ["調和", "柔軟", "集中"] },
  { name: "紺", traits: ["安定", "集中", "慎重"] }, { name: "赤", traits: ["行動", "刺激", "積極"] },
  { name: "オレンジ", traits: ["行動", "交流", "刺激"] }, { name: "黄色", traits: ["交流", "刺激", "積極"] },
  { name: "金色", traits: ["積極", "華やか", "刺激"] }, { name: "ピンク", traits: ["交流", "温かさ", "調和"] },
  { name: "紫", traits: ["独自性", "柔軟", "華やか"] }, { name: "ラベンダー", traits: ["柔軟", "調和", "独自性"] },
  { name: "銀色", traits: ["独自性", "慎重", "柔軟"] }, { name: "茶色", traits: ["安定", "自然", "慎重"] },
  { name: "ベージュ", traits: ["安定", "調和", "自然"] }, { name: "ターコイズ", traits: ["柔軟", "独自性", "交流"] }
];
const LUCKY_ITEMS = [
  { name: "ノート", traits: ["集中", "安定", "調和"] }, { name: "ペン", traits: ["集中", "行動", "独自性"] },
  { name: "時計", traits: ["安定", "集中", "慎重"] }, { name: "財布", traits: ["安定", "積極", "華やか"] },
  { name: "本", traits: ["集中", "独自性", "慎重"] }, { name: "鍵", traits: ["行動", "独自性", "慎重"] },
  { name: "バッグ", traits: ["行動", "安定", "交流"] }, { name: "靴", traits: ["行動", "積極", "刺激"] },
  { name: "帽子", traits: ["独自性", "刺激", "華やか"] }, { name: "イヤホン", traits: ["集中", "独自性", "柔軟"] },
  { name: "ハンカチ", traits: ["調和", "温かさ", "安定"] }, { name: "マグカップ", traits: ["温かさ", "安定", "調和"] },
  { name: "ペンダント", traits: ["華やか", "交流", "独自性"] }, { name: "傘", traits: ["慎重", "柔軟", "安定"] },
  { name: "スマートフォン", traits: ["交流", "柔軟", "行動"] }, { name: "腕時計", traits: ["安定", "積極", "集中"] }
];
const BLOOD_TRAITS = {
  "A型": { base: ["調和", "安定", "集中"], inverse: ["行動", "刺激", "独自性"] },
  "B型": { base: ["行動", "独自性", "柔軟"], inverse: ["安定", "慎重", "調和"] },
  "O型": { base: ["積極", "行動", "交流"], inverse: ["慎重", "安定", "集中"] },
  "AB型": { base: ["独自性", "柔軟", "集中"], inverse: ["調和", "交流", "安定"] }
};
const MARK_TRAITS = {
  spade: ["行動", "刺激", "積極"], diamond: ["華やか", "積極", "交流"],
  heart: ["温かさ", "交流", "調和"], club: ["安定", "自然", "慎重"], star: ["独自性", "刺激", "華やか"]
};
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededShuffle(items, seed) {
  const arr = [...items]; let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 16), 2246822519) + 3266489917) >>> 0;
    const j = s % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function scoreTraitMatch(item, traits) {
  return item.traits.reduce((sum, trait) => sum + (traits.includes(trait) ? 1 : 0), 0);
}
function pickDailyFive(pool, dateKey, bloodType, kind) {
  return seededShuffle(pool, hashSeed(dateKey + "|" + bloodType + "|" + kind)).slice(0, 5);
}
function narrowByBlood(five, bloodType) {
  const profile = BLOOD_TRAITS[bloodType];
  const useInverse = Math.random() < 0.20;
  const preferred = useInverse ? profile.inverse : profile.base;
  const scored = five.map(item => ({ item, score: scoreTraitMatch(item, preferred), tie: Math.random() }))
    .sort((a, b) => b.score - a.score || b.tie - a.tie);
  return { candidates: scored.slice(0, 3).map(x => x.item), mode: useInverse ? "逆傾向" : "基本傾向" };
}
function buildLuckyCandidates(dateKey, bloodType) {
  const colors = pickDailyFive(LUCKY_COLORS, dateKey, bloodType, "color");
  const items = pickDailyFive(LUCKY_ITEMS, dateKey, bloodType, "item");
  return { colors, items, colorNarrowed: narrowByBlood(colors, bloodType), itemNarrowed: narrowByBlood(items, bloodType) };
}

function pickRandomBloodMode() {
  return Math.random() < 0.20 ? "逆傾向" : "基本傾向";
}

function assignLuckyScores(items, seed) {
  const scores = seededShuffle([10, 8, 6, 4, 2], seed);
  return items.map((item, index) => ({ ...item, luckyScore: scores[index] }));
}

function buildDailyMarkScores(dateKey) {
  const keys = ["spade", "diamond", "heart", "club", "star"];
  const scores = seededShuffle([50, 40, 30, 20, 10], hashSeed(dateKey + "|daily-mark"));
  return Object.fromEntries(keys.map((key, index) => [key, scores[index]]));
}

function parseGeminiJson(bodyText) {
  let data;
  try { data = JSON.parse(bodyText); }
  catch { throw new Error("Gemini APIからJSONとして解釈できない応答が返りました。"); }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Geminiから占い結果を取得できませんでした。");
  const fence = String.fromCharCode(96, 96, 96);
  const cleaned = text.trim().replaceAll(fence + "json", "").replaceAll(fence, "").trim();
  try { return JSON.parse(cleaned); }
  catch { throw new Error("Geminiの占い結果をJSONとして解釈できませんでした。"); }
}

async function askGemini(apiKey, prompt) {
  const { response, bodyText } = await callGeminiWithRetry(apiKey, prompt);
  if (!response.ok) {
    const error = new Error("Gemini APIが占い結果の生成に失敗しました。");
    error.geminiStatus = response.status;
    error.detail = bodyText;
    throw error;
  }
  return parseGeminiJson(bodyText);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(apiKey, prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";
  const delays = [0, 2000, 5000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await sleep(delays[attempt]);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const bodyText = await response.text();

    if (response.ok) {
      return { response, bodyText };
    }

    console.error("Fortune Gemini error:", response.status, bodyText);

    // 503だけを自動再試行する。
    // 400/401/403/429などは原因が別なので、無駄に待たせない。
    if (response.status !== 503 || attempt === delays.length - 1) {
      return { response, bodyText };
    }
  }

  throw new Error("Gemini retry flow ended unexpectedly.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.FORTUNE_AI_APP_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "FORTUNE_AI_APP_GEMINI_API_KEY がVercelに設定されていません。"
    });
  }

  const { zodiac, bloodType, mark } = req.body || {};

  if (!zodiac || !bloodType || !mark) {
    return res.status(400).json({
      error: "星座・血液型・直感マークをすべて選択してください。"
    });
  }

  if (!Object.prototype.hasOwnProperty.call(ZODIAC, zodiac)) {
    return res.status(400).json({
      error: "星座の選択内容が正しくありません。"
    });
  }

  const now = new Date();

  const today = now.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });

  const japanTime = now.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });


  const sky = buildZodiacSkyData(zodiac, now);
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);

  const markTraits = MARK_TRAITS[mark] || MARK_TRAITS.star;
  const bloodProfile = BLOOD_TRAITS[bloodType];
  const bloodMode = pickRandomBloodMode();
  const bloodTraits = bloodMode === "逆傾向" ? bloodProfile.inverse : bloodProfile.base;

  try {
    const firstPrompt = [
      "あなたはAIトリプル占いの占い師です。",
      "今日の運勢文と、ラッキーカラー5候補、ラッキーアイテム5候補を選んでください。",
      "カラーとアイテムは必ず提示された候補リストから5つずつ選び、重複させないでください。",
      "星座・日付・太陽・月の状態を材料に、あなたの判断で選んでください。",
      "血液型と直感マークは第1段階では判断材料にしません。",
      "運勢文では星座名を直接書かず、1〜2文、70〜100文字程度の自然な日本語にしてください。",
      "JSONだけを返してください。",
      "今日：" + today,
      "日本時間：" + japanTime,
      "星座：" + zodiac,
      "太陽黄経：" + sky.sunLongitude + "度",
      "月黄経：" + sky.moonLongitude + "度",
      "太陽と星座中心の角距離：" + sky.sunDistance + "度",
      "月と星座中心の角距離：" + sky.moonDistance + "度",
      "太陽と月の角距離：" + sky.sunMoonDistance + "度",
      "カラー候補リスト：" + LUCKY_COLORS.map(x => x.name).join("、"),
      "アイテム候補リスト：" + LUCKY_ITEMS.map(x => x.name).join("、"),
      JSON.stringify({
        zodiacFortune: "今日の運勢の文章",
        colorFive: ["色1","色2","色3","色4","色5"],
        itemFive: ["アイテム1","アイテム2","アイテム3","アイテム4","アイテム5"]
      })
    ].join("\n");

    const first = await askGemini(apiKey, firstPrompt);
    const colorFive = Array.isArray(first.colorFive) ? first.colorFive.map(name => LUCKY_COLORS.find(x => x.name === name)).filter(Boolean) : [];
    const itemFive = Array.isArray(first.itemFive) ? first.itemFive.map(name => LUCKY_ITEMS.find(x => x.name === name)).filter(Boolean) : [];

    if (colorFive.length !== 5 || itemFive.length !== 5) {
      return res.status(502).json({ error: "Geminiが5候補を正しく選べませんでした。" });
    }

    const colorScored = assignLuckyScores(colorFive, hashSeed(dateKey + "|" + zodiac + "|" + bloodType + "|color|" + Date.now()));
    const itemScored = assignLuckyScores(itemFive, hashSeed(dateKey + "|" + zodiac + "|" + bloodType + "|item|" + Date.now()));

    const secondPrompt = [
      "AIトリプル占いの第2段階です。",
      "5候補から、指定された血液型の傾向に合うものを3つずつ選んでください。",
      "提示された候補以外は使わないでください。順位は付けず、3つを選ぶだけにしてください。",
      "血液型：" + bloodType,
      "今回の傾向：" + bloodMode,
      "判断材料：" + bloodTraits.join("・"),
      "カラー5候補：" + colorScored.map(x => x.name).join("、"),
      "アイテム5候補：" + itemScored.map(x => x.name).join("、"),
      JSON.stringify({ colorThree: ["色1","色2","色3"], itemThree: ["アイテム1","アイテム2","アイテム3"] })
    ].join("\n");

    const second = await askGemini(apiKey, secondPrompt);
    const colorThree = Array.isArray(second.colorThree) ? second.colorThree.map(name => colorScored.find(x => x.name === name)).filter(Boolean) : [];
    const itemThree = Array.isArray(second.itemThree) ? second.itemThree.map(name => itemScored.find(x => x.name === name)).filter(Boolean) : [];

    if (colorThree.length !== 3 || itemThree.length !== 3) {
      return res.status(502).json({ error: "Geminiが3候補を正しく選べませんでした。" });
    }

    const thirdPrompt = [
      "AIトリプル占いの最終選定です。",
      "提示された3候補から、直感マークの性質を材料にカラー1つ、アイテム1つを選んでください。",
      "必ず提示された3候補の中から選び、新しい候補を追加しないでください。",
      "点数は判断材料にしないでください。",
      "直感マーク：" + mark,
      "直感マークの性質：" + markTraits.join("・"),
      "カラー3候補：" + colorThree.map(x => x.name).join("、"),
      "アイテム3候補：" + itemThree.map(x => x.name).join("、"),
      JSON.stringify({ luckyColor: "選んだ色", luckyItem: "選んだアイテム" })
    ].join("\n");

    const third = await askGemini(apiKey, thirdPrompt);
    const luckyColor = colorThree.find(x => x.name === third.luckyColor);
    const luckyItem = itemThree.find(x => x.name === third.luckyItem);

    if (!luckyColor || !luckyItem) {
      return res.status(502).json({ error: "Geminiが最終選択を正しく返せませんでした。" });
    }

    const markScores = buildDailyMarkScores(dateKey);
    const markPoints = markScores[mark];
    const colorPoints = luckyColor.luckyScore;
    const itemPoints = luckyItem.luckyScore;
    const totalScore = Math.max(1, Math.min(100, sky.zodiacPoints + colorPoints + itemPoints + markPoints));

    return res.status(200).json({
      ok: true,
      fortune: {
        zodiacFortune: typeof first.zodiacFortune === "string" ? first.zodiacFortune : "",
        luckyColor: luckyColor.name,
        luckyItem: luckyItem.name,
        markGrade: "",
        totalScore
      },
      zodiacSky: { ...sky, bloodMode, colorPoints, itemPoints, markPoints }
    });

  } catch (error) {
    console.error("Fortune server error:", error);
    return res.status(500).json({
      error: "VercelからGeminiへの通信処理でエラーが発生しました。",
      detail: error.message
    });
  }
}
