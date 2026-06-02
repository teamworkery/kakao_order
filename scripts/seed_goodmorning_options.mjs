// 굿모닝차이나 메뉴 옵션 시드 (곱빼기·소스·토핑 데모)
// 실행: node scripts/seed_goodmorning_options.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*([^\s#]+)/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// [메뉴명, [그룹...]]  그룹 = {name, min, max, options:[[이름, 추가요금], ...]}
const PLAN = [
  ["짜장면", [
    { name: "양 선택", min: 1, max: 1, options: [["보통", 0], ["곱빼기", 1000]] },
  ]],
  ["짬뽕", [
    { name: "양 선택", min: 1, max: 1, options: [["보통", 0], ["곱빼기", 1000]] },
    { name: "추가 토핑", min: 0, max: 3, options: [["면사리", 1500], ["공기밥", 1000], ["청양고추", 0]] },
  ]],
  ["볶음밥", [
    { name: "양 선택", min: 1, max: 1, options: [["보통", 0], ["곱빼기", 1000]] },
  ]],
  ["과일탕수육(S)", [
    { name: "소스", min: 1, max: 1, options: [["부어서", 0], ["찍어서", 0]] },
  ]],
];

async function main() {
  const { data: prof, error: pe } = await supa
    .from("profiles").select("profile_id").eq("name", "goodmorning-china").single();
  if (pe || !prof) throw new Error("프로필 없음: " + (pe?.message || ""));
  const pid = prof.profile_id;

  let groupCount = 0, optCount = 0;
  for (const [itemName, groups] of PLAN) {
    const { data: item } = await supa
      .from("menuItem").select("id").eq("profile_id", pid).eq("name", itemName).limit(1).maybeSingle();
    if (!item) { console.log("⚠ 메뉴 없음, 건너뜀:", itemName); continue; }

    // 기존 그룹 정리 (cascade로 옵션도 삭제)
    await supa.from("menu_option_groups").delete().eq("menu_item_id", item.id);

    let gOrder = 0;
    for (const g of groups) {
      const { data: grp, error: ge } = await supa.from("menu_option_groups").insert({
        profile_id: pid, menu_item_id: item.id, name: g.name,
        min_select: g.min, max_select: g.max, display_order: ++gOrder,
      }).select("id").single();
      if (ge) throw ge;
      groupCount++;
      const rows = g.options.map(([name, delta], i) => ({
        profile_id: pid, group_id: grp.id, name, price_delta: delta, display_order: i + 1,
      }));
      const { error: oe } = await supa.from("menu_options").insert(rows);
      if (oe) throw oe;
      optCount += rows.length;
    }
    console.log("• " + itemName + " → 그룹 " + groups.length + "개");
  }
  console.log(`\n✅ 옵션 시드 완료: 그룹 ${groupCount}개 / 옵션 ${optCount}개`);
}
main().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
