// 굿모닝차이나(부천 상동) 실제 메뉴 시드 스크립트
// 출처: 네이버 플레이스 place/13115778 (메뉴/가격/주소/전화), 블로그 리뷰(영업시간)
// 실행: node scripts/seed_goodmorning_china.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ---- .env 로드 (간단 파서) ----
const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SUPABASE_URL / SERVICE_ROLE_KEY 누락");

const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- 가게 정보 ----
const STORE = {
  slug: "goodmorning-china",
  storename: "굿모닝차이나",
  storenumber: "032-327-9696",
  store_description:
    "상동역 7번출구 뱅뱅프라자 2층 · 한자리에서 오래 자리를 지켜온 동네 단골 중식당입니다. 직화로 볶은 짜장과 비리지 않은 굴짬뽕이 자랑이에요. 포장·예약 가능, 매장 이용 시 최대 2시간 무료 주차.",
  prep_time: 20,
  ownerEmail: "goodmorning-china@demo.pojang.one",
  ownerPassword: "Goodmorning2026!",
  hours: { open: "10:00:00", close: "21:30:00" }, // 매일 동일
};

// ---- 메뉴 (카테고리 순서대로) ----
// d = 설명(옵션)
const MENU = [
  ["세트 메뉴", [
    ["탕수육+짜장+짜장", 31000, "간짜장·삼선짜장·매운짜장 변경 가능(+요금 추가)"],
    ["탕수육+짜장+짬뽕", 32000, "짜장/짬뽕 변경 가능(+요금 추가)"],
    ["탕수육+짬뽕2", 34000, "고기짬뽕·삼선짬뽕·삼선고추짬뽕 변경 가능(+요금 추가)"],
    ["탕수육+쟁반짜장(2인)", 36000],
    ["탕수육+볶음밥+볶음밥", 34000, "탕수육(2인분)+볶음밥 2인분+짬뽕국물 2개"],
    ["탕수육+짜장+볶음밥", 32000],
    ["탕수육+짬뽕+볶음밥", 34000],
    ["탕수육+식사1", 25000],
    ["탕수육+물냉면2", 34000],
    ["탕수육+물냉면1+비빔냉면1", 35000],
    ["탕수육+비빔냉면2", 36000],
  ]],
  ["면류", [
    ["짜장면", 8000, "고온에서 볶은 푸짐한 고기와 채소가 함께해 더 맛있는 짜장면"],
    ["간짜장", 9500, "한 그릇씩 볶아 깊고 진한 풍미의 진짜 간짜장"],
    ["매운간짜장", 10000],
    ["삼선간짜장", 13000],
    ["삼선쟁반짜장(2인분)", 22000],
    ["삼선쟁반짜장(3인분)", 30000],
    ["차이나 냉짬뽕", 11000],
    ["삼선백짬뽕", 13000],
    ["짬뽕", 9500],
    ["해물고기짬뽕", 13000],
    ["삼선짬뽕", 13000],
    ["삼선고추짬뽕(1인분)", 13000],
    ["홍합짬뽕", 11500],
    ["삼선볶음짬뽕(2인분)", 22000],
    ["삼선볶음짬뽕(3인분)", 30000],
    ["우동", 9500],
    ["삼선우동", 13000],
    ["울면", 10000],
    ["삼선울면", 13000],
    ["기스면", 10000],
    ["술국", 25000],
    ["중국냉면", 11000],
    ["물냉면", 9000],
    ["콩국수", 9000],
    ["비빔냉면", 9500],
  ]],
  ["밥류", [
    ["볶음밥", 9500, "볶음밥+짬뽕국물+짜장소스"],
    ["새우볶음밥", 12000, "새우볶음밥+짬뽕국물+짜장소스"],
    ["삼선볶음밥", 13000, "삼선볶음밥+짬뽕국물+짜장소스"],
    ["게살매운볶음밥", 12000, "게살매운볶음밥+짬뽕국물"],
    ["짜장밥", 9500, "짜장밥+짬뽕국물"],
    ["짬뽕밥", 10000],
    ["삼선짬뽕밥", 13000],
    ["삼선고추짬뽕밥", 13000],
    ["해물고기짬뽕밥", 13000],
    ["삼선백짬뽕밥", 13000],
    ["잡탕밥", 16000, "잡탕밥+짬뽕국물"],
    ["류산슬밥", 14500, "류산슬밥+짬뽕국물"],
    ["마파두부밥", 10000, "마파두부밥+짬뽕국물"],
    ["고추잡채덮밥", 12000, "고추잡채덮밥+짬뽕국물"],
    ["소고기잡채밥", 11000, "소고기잡채밥+짬뽕국물"],
    ["버섯새우덮밥", 10500, "버섯새우덮밥+짬뽕국물"],
    ["제육덮밥", 10000, "제육덮밥+짬뽕국물"],
    ["김치볶음밥", 10000, "김치볶음밥+짬뽕국물"],
    ["오징어덮밥", 10000, "오징어덮밥+짬뽕국물"],
    ["공기밥", 1500],
  ]],
  ["요리 세트", [
    ["요리+짜장+짜장", 45000],
    ["요리+짜장+짬뽕", 46000],
    ["요리+짬뽕+짬뽕", 47000],
    ["요리+쟁반짜장", 48000],
    ["요리+쟁반짬뽕", 48000],
    ["요리+볶음밥2", 47000],
    ["요리+면+볶음밥", 46000],
  ]],
  ["코스 요리", [
    ["탕수육+양장피+군만두+물만두", 60000],
    ["탕수육+양장피+팔보채+군만두+물만두", 85000],
    ["탕수육+양장피+유산슬+고추잡채+군만두+물만두", 120000],
    ["탕수육+양장피+유산슬+고추잡채+팔보채+군만두+물만두", 160000],
  ]],
  ["반반 메뉴", [
    ["짬짜면", 11500],
    ["볶짜면", 12000, "볶짜면+짬뽕국물"],
    ["볶짬면", 12000],
    ["탕짜면", 12500, "직화 짜장면과 새콤달콤 탕수육을 한 그릇에"],
    ["탕짬면", 13000],
    ["탕볶밥", 13500, "탕볶밥+짬뽕국물"],
  ]],
  ["소고기 요리", [
    ["소고기고추잡채+꽃빵(S)", 34000],
    ["소고기고추잡채+꽃빵(L)", 44000],
  ]],
  ["돼지고기 요리", [
    ["과일탕수육(S)", 23000],
    ["과일탕수육(M)", 28000],
    ["과일탕수육(L)", 33000],
    ["광동탕수육(S)", 23000],
    ["광동탕수육(M)", 28000],
    ["광동탕수육(L)", 33000],
    ["사천탕수육(S)", 23000],
    ["사천탕수육(M)", 28000],
    ["사천탕수육(L)", 33000],
    ["난자완스(S)", 36000],
    ["난자완스(L)", 46000],
  ]],
  ["닭고기 요리", [
    ["깐풍기(S)", 31000],
    ["깐풍기(L)", 41000],
    ["유린기(S)", 34000],
    ["유린기(L)", 44000],
  ]],
  ["새우 요리", [
    ["깐쇼새우(S)", 34000, "칠리소스에 버무린 새우"],
    ["깐쇼새우(L)", 49000, "칠리소스에 버무린 새우"],
    ["깐쇼중새우(S)", 34000, "칠리소스에 버무린 새우"],
    ["깐쇼중새우(L)", 49000, "칠리소스에 버무린 새우"],
    ["깐풍새우(S)", 34000, "칠리소스에 튀긴 새우"],
    ["깐풍새우(L)", 49000, "칠리소스에 튀긴 새우"],
    ["깐풍중새우(S)", 34000, "칠리소스에 튀긴 새우"],
    ["깐풍중새우(L)", 49000, "칠리소스에 튀긴 새우"],
    ["크림중새우(S)", 34000],
    ["크림중새우(L)", 49000],
    ["해삼관자(S)", 56000],
    ["해삼관자(L)", 76000],
  ]],
  ["요리류", [
    ["전가복(S)", 61000],
    ["전가복(L)", 81000],
    ["유산슬(S)", 34000],
    ["유산슬(L)", 44000],
    ["삼선누룽지탕(S)", 36000],
    ["삼선누룽지탕(L)", 49000],
    ["팔보채(S)", 39000],
    ["팔보채(L)", 56000],
    ["양장피(S)", 34000],
    ["양장피(L)", 43000],
    ["마파두부(S)", 26000],
    ["마파두부(L)", 36000],
  ]],
  ["샥스핀", [
    ["삼선샥스핀(S)", 56000],
    ["삼선샥스핀(L)", 71000],
    ["게살샥스핀(S)", 51000],
    ["게살샥스핀(L)", 66000],
  ]],
  ["냉채", [
    ["네가지냉채(S)", 34000],
    ["네가지냉채(L)", 44000],
  ]],
  ["만두 · 빵", [
    ["물만두", 7000],
    ["군만두", 6000],
    ["꽃빵(1인분, 4개)", 3500],
    ["춘권(10개)", 7500],
    ["짬뽕국물(공기그릇)", 1500],
    ["짬뽕국물(큰공기)", 2500],
  ]],
  ["음료", [
    ["제로콜라 355ml", 3000],
    ["콜라 355ml", 3000],
    ["사이다 355ml", 3000],
  ]],
];

async function main() {
  // 1) 오너 auth 유저 확보 (멱등)
  let userId;
  const created = await supa.auth.admin.createUser({
    email: STORE.ownerEmail,
    password: STORE.ownerPassword,
    email_confirm: true,
  });
  if (created.error) {
    if (/registered|exists/i.test(created.error.message)) {
      const { data } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const u = data.users.find((x) => x.email === STORE.ownerEmail);
      if (!u) throw new Error("기존 유저 조회 실패: " + created.error.message);
      userId = u.id;
      console.log("• 기존 오너 계정 재사용:", userId);
    } else {
      throw created.error;
    }
  } else {
    userId = created.data.user.id;
    console.log("• 오너 계정 생성:", userId);
  }

  // 2) 프로필 upsert (role=owner)
  const { error: pErr } = await supa.from("profiles").upsert(
    {
      profile_id: userId,
      email: STORE.ownerEmail,
      name: STORE.slug,
      storename: STORE.storename,
      storenumber: STORE.storenumber,
      store_description: STORE.store_description,
      default_prep_time_minutes: STORE.prep_time,
      role: "owner",
    },
    { onConflict: "profile_id" }
  );
  if (pErr) throw pErr;
  console.log("• 프로필 저장 완료 (slug:", STORE.slug + ")");

  // 3) 기존 메뉴/카테고리 정리 (멱등)
  await supa.from("menuItem").delete().eq("profile_id", userId);
  await supa.from("categories").delete().eq("profile_id", userId);

  // 4) 카테고리 삽입
  const catRows = MENU.map(([name], i) => ({
    profile_id: userId,
    name,
    display_order: i + 1,
  }));
  const { data: cats, error: cErr } = await supa.from("categories").insert(catRows).select("id, name");
  if (cErr) throw cErr;
  const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));
  console.log("• 카테고리", cats.length + "개 삽입");

  // 5) 메뉴 아이템 삽입
  const items = [];
  let order = 0;
  for (const [catName, list] of MENU) {
    for (const [name, price, desc] of list) {
      items.push({
        profile_id: userId,
        category_id: catId[catName],
        category: catName, // 섹션 헤딩 표시용(레거시 필드)
        name,
        price,
        description: desc ?? null,
        isActive: true,
        displayOrder: ++order,
      });
    }
  }
  const { error: mErr } = await supa.from("menuItem").insert(items);
  if (mErr) throw mErr;
  console.log("• 메뉴", items.length + "개 삽입");

  // 6) 영업시간 (매일 10:00~21:30)
  await supa.from("store_hours").delete().eq("profile_id", userId);
  const hours = Array.from({ length: 7 }, (_, dow) => ({
    profile_id: userId,
    day_of_week: dow,
    open_time: STORE.hours.open,
    close_time: STORE.hours.close,
    is_closed: false,
  }));
  const { error: hErr } = await supa.from("store_hours").insert(hours);
  if (hErr) throw hErr;
  console.log("• 영업시간 7일 저장 (10:00~21:30)");

  console.log("\n✅ 완료!  ", (env.VITE_APP_URL || "http://localhost:5173") + "/" + STORE.slug);
  console.log("   오너 로그인:", STORE.ownerEmail, "/", STORE.ownerPassword);
}

main().catch((e) => {
  console.error("❌ 실패:", e.message || e);
  process.exit(1);
});
