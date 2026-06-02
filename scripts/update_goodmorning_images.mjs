// 굿모닝차이나 메뉴에 음식 사진 매칭 (위키미디어 커먼즈, 핫링크 허용)
// 실행: node scripts/update_goodmorning_images.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const env = {};
for (const l of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const SLUG = "goodmorning-china";

const U = "https://upload.wikimedia.org/wikipedia/commons/";
const IMG = {
  jajang: U + "thumb/7/78/Jajangmyeon.jpg/960px-Jajangmyeon.jpg",
  jjamppong: U + "4/44/Jjampong.JPG",
  tangsuyuk: U + "4/4d/Tangsuyuk_%28Korean_Chinese_sweet_and_sour_pork%29.jpg",
  bokkeumbap: U + "thumb/c/c3/Koh_Mak%2C_Thailand%2C_Fried_rice_with_seafood%2C_Thai_fried_rice.jpg/960px-Koh_Mak%2C_Thailand%2C_Fried_rice_with_seafood%2C_Thai_fried_rice.jpg",
  kimchibokkeum: U + "thumb/c/cd/Kimchi-bokkeum-bap.jpg/960px-Kimchi-bokkeum-bap.jpg",
  kkanpunggi: U + "thumb/c/c5/Kkanpunggi.jpg/960px-Kkanpunggi.jpg",
  yurinki: U + "thumb/9/9a/You-lin-ji_Japan.jpg/960px-You-lin-ji_Japan.jpg",
  yangjangpi: U + "7/79/Yangjangpi.jpg",
  palbochae: U + "thumb/4/48/Palbo-chae.jpg/960px-Palbo-chae.jpg",
  yusanseul: U + "thumb/0/0b/Yusanseul.jpg/960px-Yusanseul.jpg",
  nanjawanseu: U + "9/94/Nanja-wanseu.jpg",
  mapa: U + "thumb/a/a5/Billyfoodmabodofu3.jpg/960px-Billyfoodmabodofu3.jpg",
  gochujapchae: U + "9/9d/Pepper_steak.jpg",
  ulmyeon: U + "d/d9/Ulmyeon.jpg",
  udon: U + "9/97/Kakeudon.jpg",
  naengmyeon: U + "1/14/Korean_Chinese_cold_noodles.jpg",
  kongguksu: U + "thumb/b/b9/Korean_noodles-Kongguksu-01.jpg/960px-Korean_noodles-Kongguksu-01.jpg",
  kkotppang: U + "thumb/c/cb/Hu%C4%81ju%C7%8En.jpg/960px-Hu%C4%81ju%C7%8En.jpg",
  chunkwon: U + "thumb/9/95/Spring_rolls_001.jpg/960px-Spring_rolls_001.jpg",
  ojingeo: U + "9/94/Squidu.jpg",
  jeyuk: U + "6/65/%EC%A0%9C%EC%9C%A1_%EB%B3%B6%EC%9D%8C.jpg",
  kkansyo: U + "thumb/5/54/Kkansyo-saeu_DSC00978.jpg/960px-Kkansyo-saeu_DSC00978.jpg",
  nurungji: U + "1/16/Korean.food-Nurungji-01.jpg",
  mandu: U + "thumb/0/0c/%EB%A7%8C%EB%91%90.jpg/960px-%EB%A7%8C%EB%91%90.jpg",
  dimsum: U + "thumb/1/13/Dim_sum.jpg/960px-Dim_sum.jpg",
  sharkfin: U + "thumb/9/91/Chinese_cuisine-Shark_fin_soup-04.jpg/960px-Chinese_cuisine-Shark_fin_soup-04.jpg",
  seafood: U + "thumb/a/ae/Plateau_van_zeevruchten.jpg/960px-Plateau_van_zeevruchten.jpg",
  cola: U + "thumb/6/68/Coca-cola_JesusDiaz.jpeg/960px-Coca-cola_JesusDiaz.jpeg",
  cider: U + "thumb/d/d3/Cider_%28lemon-lime_drink%29.jpg/960px-Cider_%28lemon-lime_drink%29.jpg",
};

const has = (n, ...ks) => ks.some((k) => n.includes(k));
// 이름 기반 매칭 (위에서부터 먼저 일치하는 규칙 적용)
function pick(name, category) {
  const n = name;
  if (has(n, "콜라")) return "cola";
  if (has(n, "사이다")) return "cider";
  if (has(n, "탕수육")) return "tangsuyuk";              // 세트·코스·과일/광동/사천탕수육
  if (has(n, "군만두")) return "dimsum";
  if (has(n, "물만두", "교자")) return "mandu";
  if (has(n, "꽃빵")) return "kkotppang";
  if (has(n, "춘권")) return "chunkwon";
  if (has(n, "짬뽕국물")) return "jjamppong";
  if (has(n, "깐풍기")) return "kkanpunggi";
  if (has(n, "유린기")) return "yurinki";
  if (has(n, "새우", "깐쇼")) return "kkansyo";          // 새우류 전부
  if (has(n, "해삼관자", "전가복")) return "seafood";
  if (has(n, "양장피")) return "yangjangpi";
  if (has(n, "냉채")) return "yangjangpi";
  if (has(n, "팔보채")) return "palbochae";
  if (has(n, "난자완스")) return "nanjawanseu";
  if (has(n, "누룽지")) return "nurungji";
  if (has(n, "샥스핀")) return "sharkfin";
  if (has(n, "마파두부")) return "mapa";
  if (has(n, "잡채")) return "gochujapchae";              // 고추잡채/소고기잡채
  if (has(n, "유산슬", "류산슬")) return "yusanseul";
  if (has(n, "요리+")) return "palbochae";                // 요리 세트
  if (has(n, "탕볶밥")) return "bokkeumbap";              // 반반
  if (has(n, "짬짜면", "볶짜면", "탕짜면")) return "jajang";
  if (has(n, "볶짬면", "탕짬면")) return "jjamppong";
  if (has(n, "짜장", "쟁반짜장")) return "jajang";        // 짜장면/간짜장/짜장밥 등
  if (has(n, "냉짬뽕", "냉면")) return "naengmyeon";
  if (has(n, "백짬뽕", "짬뽕")) return "jjamppong";
  if (has(n, "콩국수")) return "kongguksu";
  if (has(n, "울면")) return "ulmyeon";
  if (has(n, "우동", "기스면")) return "udon";
  if (has(n, "술국")) return "jjamppong";
  if (has(n, "김치볶음밥")) return "kimchibokkeum";
  if (has(n, "오징어")) return "ojingeo";
  if (has(n, "제육")) return "jeyuk";
  if (has(n, "볶음밥", "볶밥")) return "bokkeumbap";
  if (has(n, "덮밥", "공기밥")) return "bokkeumbap";
  // 카테고리 폴백
  if (category === "면류") return "jjamppong";
  if (category === "밥류") return "bokkeumbap";
  if (category === "새우 요리") return "kkansyo";
  if (category === "냉채") return "yangjangpi";
  return "palbochae";
}

const UA = "kakao-order-demo/1.0 (https://pojang.one; contact woomin@workery.org)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 위키미디어 이미지를 public/menu-images/ 로 다운로드 (self-host) → 상대경로 반환
async function download(key, url, outDir) {
  const ext = url.toLowerCase().includes(".png") ? "png" : url.toLowerCase().includes(".jpeg") ? "jpg" : "jpg";
  const file = join(outDir, `${key}.${ext}`);
  const webPath = `/menu-images/${key}.${ext}`;
  if (existsSync(file)) return webPath;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://pojang.one/" } });
    if (r.status === 200) {
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(file, buf);
      return webPath;
    }
    if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    throw new Error(`${key} HTTP ${r.status}`);
  }
  throw new Error(`${key} 다운로드 실패 (429 반복)`);
}

async function main() {
  // 0) 이미지 다운로드 (self-host)
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "menu-images");
  mkdirSync(outDir, { recursive: true });
  console.log("이미지 다운로드 → public/menu-images/ …");
  const LOCAL = {};
  for (const [k, url] of Object.entries(IMG)) {
    LOCAL[k] = await download(k, url, outDir);
    process.stdout.write("·");
    await sleep(400); // 정중한 간격
  }
  console.log(`\n✓ ${Object.keys(LOCAL).length}개 다운로드 완료`);

  // 1) 프로필/메뉴 조회
  const { data: prof } = await supa.from("profiles").select("profile_id").eq("name", SLUG).single();
  const pid = prof.profile_id;
  const { data: items } = await supa
    .from("menuItem").select("id, name, category").eq("profile_id", pid);

  // 2) 매칭 후 업데이트
  const summary = {};
  for (const it of items) {
    const key = pick(it.name, it.category);
    summary[key] = (summary[key] || 0) + 1;
    const { error } = await supa.from("menuItem").update({ image: LOCAL[key] }).eq("id", it.id);
    if (error) throw error;
  }

  // 3) 가게 대표 이미지 = 짬뽕(굴짬뽕 대표메뉴)
  await supa.from("profiles").update({ store_image: LOCAL.jjamppong }).eq("profile_id", pid);

  console.log(`\n✅ 메뉴 ${items.length}개 사진 업데이트 완료`);
  console.log("매칭 분포:", Object.entries(summary).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join("  "));
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
