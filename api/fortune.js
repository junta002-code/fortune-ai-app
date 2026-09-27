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
function aspectScore(distance) {
  const aspects = [
    { angle: 0, score: 12 },
    { angle: 60, score: 8 },
    { angle: 90, score: -7 },
    { angle: 120, score: 8 },
    { angle: 180, score: -10 }
  ];

  let best = { score: 0, difference: Infinity };

  for (const aspect of aspects) {
    const difference = Math.abs(distance - aspect.angle);
    if (difference < best.difference) {
      best = { score: aspect.score, difference };
    }
  }

  if (best.difference >= 30) return 0;
  return best.score * (1 - best.difference / 30);
}

function buildZodiacSkyData(zodiac, date) {
  const signStart = ZODIAC[zodiac];
  const signCenter = normalizeAngle(signStart + 15);
  const { sunLongitude, moonLongitude } = getSunMoonLongitude(date);

  const sunDistance = angularDistance(sunLongitude, signCenter);
  const moonDistance = angularDistance(moonLongitude, signCenter);

  const sunScore = aspectScore(sunDistance);
  const moonScore = aspectScore(moonDistance);
  const skyScore = Math.round(sunScore * 0.45 + moonScore * 0.55);

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
    skyScore,
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
  const lucky = buildLuckyCandidates(dateKey, bloodType);
  const markTraits = MARK_TRAITS[mark] || MARK_TRAITS.star;

  const prompt = `
あなたは「AIトリプル占い」の占い師です。

今回は、「今日の運勢」と「ラッキーカラー」「ラッキーアイテム」を作ってください。
星座部分は太陽・月・選択された星座の3要素を使います。
ラッキーカラーとラッキーアイテムは、プログラム側ですでに候補を絞っています。

重要：
- 天体の位置計算はプログラム側ですでに行っています。
- 下記の数値と候補を材料として使ってください。
- 「今日の運勢」の文章では、血液型と直感マークを直接説明しないでください。
- 結果文章の中で選択した星座名を直接書かないでください。
- ラッキーカラーは提示された3候補から必ず1つ選んでください。
- ラッキーアイテムも提示された3候補から必ず1つ選んでください。
- 3候補は血液型の基本傾向80%・逆傾向20%を反映して、すでに作られています。再計算は不要です。
- 最終選択では直感マークの傾向を参考にして3候補から1つ選んでください。
- 直感マークは結果文章では説明せず、ラッキーの選択にだけ内部的に使ってください。
- 「占星術では〜」などの説明も不要です。
- 占いとして楽しく読める文章にしてください。
- 1〜2文、70〜100文字程度の自然な日本語にしてください。
- 「今日の運勢＝」という見出しはプログラム側で付けます。
- 同じ星座でも月は時間とともに動くため、占う時刻によって少し違う表現になって構いません。

今日：${today}
日本時間：${japanTime}

選択された星座：${sky.zodiac}
選択された星座の中心黄経：${sky.zodiacCenterLongitude}度
太陽の黄経：${sky.sunLongitude}度
月の黄経：${sky.moonLongitude}度
太陽と星座中心の角距離：${sky.sunDistance}度
月と星座中心の角距離：${sky.moonDistance}度
内部運勢傾向：${sky.tendency}
内部運勢スコア：${sky.skyScore}

血液型：${bloodType}
直感マーク：${mark}
直感マークの選択傾向：${markTraits.join("・")}

今日のラッキーカラー5候補：
${lucky.colors.map(x => x.name).join("、")}
血液型で3候補に絞ったラッキーカラー：
${lucky.colorNarrowed.candidates.map(x => x.name).join("、")}
血液型の絞り込み：${lucky.colorNarrowed.mode}

今日のラッキーアイテム5候補：
${lucky.items.map(x => x.name).join("、")}
血液型で3候補に絞ったラッキーアイテム：
${lucky.itemNarrowed.candidates.map(x => x.name).join("、")}
血液型の絞り込み：${lucky.itemNarrowed.mode}

出力はJSONオブジェクトだけにしてください。
Markdownのコードブロックや前後の説明文は付けないでください。

{
  "zodiacFortune": "今日の運勢の文章",
  "luckyColor": "3候補から選んだ色",
  "luckyItem": "3候補から選んだアイテム",
  "markGrade": "",
  "totalScore": 0
}

luckyColor と luckyItem は必ず提示された3候補の中から1つずつ選んでください。
markGrade と totalScore は今回は空欄または0のままにしてください。
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const bodyText = await response.text();

    if (!response.ok) {
      console.error("Fortune Gemini error:", response.status, bodyText);
      return res.status(502).json({
        error: "Gemini APIが占い結果の生成に失敗しました。",
        geminiStatus: response.status,
        detail: bodyText
      });
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return res.status(502).json({
        error: "Gemini APIからJSONとして解釈できない応答が返りました。"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(502).json({
        error: "Geminiから占い結果を取得できませんでした。",
        raw: data
      });
    }

    const cleanedText = text
      .trim()
      .replace(/^\`\`\`json\s*/i, "")
      .replace(/^\`\`\`\s*/i, "")
      .replace(/\s*\`\`\`$/i, "")
      .trim();

    let fortune;
    try {
      fortune = JSON.parse(cleanedText);
    } catch {
      return res.status(502).json({
        error: "Geminiの占い結果をJSONとして解釈できませんでした。",
        raw: text
      });
    }

    return res.status(200).json({
      ok: true,
      fortune,
      zodiacSky: sky
    });
  } catch (error) {
    console.error("Fortune server error:", error);
    return res.status(500).json({
      error: "VercelからGeminiへの通信処理でエラーが発生しました。",
      detail: error.message
    });
  }
}
