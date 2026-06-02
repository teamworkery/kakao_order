import { useState, useEffect } from "react";
import { Link } from "react-router";

const DEMO_STORE = "/goodmorning-china";

export default function Index() {
  const [showFloatingCta, setShowFloatingCta] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = 480;
      setShowFloatingCta(window.scrollY > heroHeight);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/70">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-[20px] leading-none">🏮</span>
            <span className="text-[16px] font-bold tracking-tight">
              pojang<span className="text-primary">.one</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/customer/orders"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-full"
            >
              주문내역
            </Link>
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center h-9 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-full"
            >
              로그인
            </Link>
            <Link
              to="/join"
              className="inline-flex items-center h-10 px-4 text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all rounded-full shadow-warm"
            >
              시작하기
            </Link>
          </div>
        </div>
      </header>

      {/* Floating CTA */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          showFloatingCta
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <Link
          to="/join"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground text-[14px] font-semibold tracking-tight shadow-glow hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">storefront</span>
          무료로 내 가게 만들기
        </Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* 등불 글로우 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_-5%,rgba(238,124,43,0.20),transparent_70%)]"
        />
        <div className="relative max-w-3xl mx-auto px-5 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <div className="inline-flex items-center gap-2 h-8 px-3.5 mb-7 rounded-full bg-primary-light border border-primary/20 text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="text-[12px] font-semibold tracking-tight">
              베타 출시 이벤트 진행중 · 선착순 5팀
            </span>
          </div>
          <h1 className="text-[36px] sm:text-[52px] font-extrabold tracking-tight leading-[1.12] mb-5">
            배달앱 수수료 없이
            <br />내 가게{" "}
            <span className="relative whitespace-nowrap text-primary">
              포장 주문
              <span
                aria-hidden
                className="absolute left-0 -bottom-1 h-[10px] w-full rounded-full bg-primary/20"
              />
            </span>{" "}
            페이지
          </h1>
          <p className="text-[16px] sm:text-[18px] text-muted-foreground leading-relaxed max-w-xl mx-auto mb-9">
            카카오톡 채널과 연동되는 우리 가게 전용 주문 페이지.
            <br className="hidden sm:block" />
            메뉴 등록부터 알림까지 10분이면 충분합니다. 월{" "}
            <span className="text-foreground font-semibold">10,000원</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              to="/join"
              className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-primary text-primary-foreground text-[15px] font-semibold tracking-tight shadow-glow hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
            >
              무료로 시작하기
            </Link>
            <Link
              to={DEMO_STORE}
              className="inline-flex items-center justify-center gap-1.5 h-12 px-7 rounded-full border border-border bg-background/70 text-foreground text-[15px] font-semibold tracking-tight hover:bg-secondary hover:-translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              샘플 가게 둘러보기
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
            {["설치비 무료", "주문 수수료 0%", "즉시 개설"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">
                  check_circle
                </span>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <Eyebrow>이런 고민, 있으시죠?</Eyebrow>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-tight mb-12">
            아직도 수수료 내며
            <br className="sm:hidden" /> 전화로 주문 받으세요?
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: "trending_down",
                title: "수수료 부담",
                body: "주문당 15% 수수료가 쌓이면 한 달 수십만원.",
              },
              {
                icon: "phone_missed",
                title: "전화 주문 불편",
                body: "바쁜 시간 전화 받기 힘들고, 주문 실수도 잦아요.",
              },
              {
                icon: "person_off",
                title: "단골 관리 어려움",
                body: "한 번 온 손님을 다시 부르기 어려워요.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="flex flex-col bg-card border border-border rounded-2xl p-6 shadow-warm"
              >
                <div className="size-11 rounded-2xl bg-primary-light flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    {c.icon}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold tracking-tight mb-1.5">{c.title}</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section>
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <Eyebrow>이렇게 바뀝니다</Eyebrow>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-tight mb-3">
            포장 주문, 한 곳에서 끝.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-muted-foreground mb-12 max-w-xl">
            복잡한 배달앱 없이, 우리 가게 전용 주문 페이지로 간편하게.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: "storefront",
                title: "내 가게 전용 주문 페이지",
                body: "pojang.one/가게이름 형태의 깔끔한 주문 페이지. 메뉴 등록부터 주문 관리까지 한 곳에서.",
              },
              {
                icon: "chat",
                title: "카카오톡 채널 연동",
                body: "카카오톡 채널의 '주문하기' 버튼과 연결. 고객은 익숙한 카카오톡에서 바로 주문.",
              },
              {
                icon: "notifications_active",
                title: "실시간 주문 알림",
                body: "새 주문이 들어오면 사장님 핸드폰으로 즉시 알림. 주문 확인·준비완료까지 자동.",
              },
              {
                icon: "loyalty",
                title: "단골 고객 관리",
                body: "카카오 채널 친구에게 이벤트 쿠폰, 날씨 할인 등 맞춤 메시지로 재방문 유도.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="flex flex-col bg-card border border-border rounded-2xl p-6 shadow-warm hover:-translate-y-1 hover:shadow-warm-lg transition-all"
              >
                <div className="size-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-4 shadow-warm">
                  <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
                </div>
                <h3 className="text-[16px] font-bold tracking-tight mb-1.5">{c.title}</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <Eyebrow>이용 방법</Eyebrow>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-tight mb-12">
            3단계면 바로 장사 시작.
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { num: "1", title: "회원가입", body: "카카오로 간편 가입" },
              { num: "2", title: "가게 정보 입력", body: "메뉴와 가격 등록" },
              { num: "3", title: "주문 받기", body: "바로 운영 시작" },
            ].map((s) => (
              <div
                key={s.num}
                className="flex flex-col bg-card border border-border rounded-2xl p-6 shadow-warm"
              >
                <span className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[15px] font-bold tabular-nums mb-4">
                  {s.num}
                </span>
                <h3 className="text-[17px] font-bold tracking-tight mb-1">{s.title}</h3>
                <p className="text-[14px] text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section>
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <Eyebrow>요금제</Eyebrow>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-tight mb-3">
            투명한 단일 요금제.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-muted-foreground mb-12 max-w-xl">
            숨겨진 비용 없이, 딱 월 이용료만.
          </p>

          <div className="max-w-md">
            <div className="relative border-2 border-primary/30 rounded-3xl p-8 bg-card shadow-warm-lg">
              <span className="absolute -top-3 left-8 inline-flex items-center h-6 px-3 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tracking-tight shadow-warm">
                주문 수수료 0%
              </span>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-[48px] font-extrabold tracking-tight tabular-nums leading-none">
                  10,000
                </span>
                <span className="text-[18px] text-muted-foreground">원</span>
                <span className="text-[13px] text-muted-foreground ml-1">/ 월</span>
              </div>
              <p className="text-[13px] text-muted-foreground mb-6">약정 없음 · 언제든 해지</p>
              <div className="h-px bg-border mb-6" />
              <ul className="space-y-3.5 mb-8">
                {[
                  "주문 수수료 0%",
                  "전용 주문 페이지",
                  "카카오톡 채널 연동",
                  "실시간 주문 알림",
                  "무제한 메뉴 등록",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[14px] text-foreground">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      check_circle
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/join"
                className="inline-flex w-full items-center justify-center h-12 rounded-full bg-primary text-primary-foreground text-[15px] font-semibold tracking-tight shadow-glow hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
              >
                지금 시작하기
              </Link>
            </div>

            <div className="mt-5 p-5 rounded-2xl bg-primary-light border border-primary/15">
              <p className="text-[13px] font-bold text-foreground mb-1.5 tracking-tight">
                💸 수수료 비교
              </p>
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                배달앱 수수료 평균 15% 기준 월 100만원 매출이면{" "}
                <span className="text-foreground font-semibold">15만원</span>이 수수료.
                pojang.one은 매출 무관 <span className="text-primary font-semibold">월 1만원</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Launch event — 한밤 포장마차 */}
      <section className="relative overflow-hidden bg-[#241a13] text-[#fbf6ef]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_85%_0%,rgba(238,124,43,0.28),transparent_60%)]"
        />
        <div className="relative max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-[22px]">🏮</span>
            <span className="text-[12px] font-bold tracking-[0.12em] text-primary uppercase">
              출시 기념
            </span>
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight leading-tight mb-3">
            베타 한정 혜택.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-[#fbf6ef]/70 mb-10 max-w-xl">
            선착순 5팀에 한해 진행됩니다.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <div className="rounded-2xl border border-[#fbf6ef]/15 bg-[#fbf6ef]/[0.04] p-6">
              <p className="text-[13px] text-[#fbf6ef]/60 mb-1.5">1개월 결제 시</p>
              <p className="text-[22px] font-bold tracking-tight text-primary">3개월 이용</p>
            </div>
            <div className="rounded-2xl border border-[#fbf6ef]/15 bg-[#fbf6ef]/[0.04] p-6">
              <p className="text-[13px] text-[#fbf6ef]/60 mb-1.5">
                카카오채널 개설 대행 <span className="line-through ml-1">3만원</span>
              </p>
              <p className="text-[22px] font-bold tracking-tight text-primary">무료</p>
            </div>
          </div>
          <Link
            to="/join"
            className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-primary text-primary-foreground text-[15px] font-semibold tracking-tight shadow-glow hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
          >
            이벤트 신청하기
          </Link>
        </div>
      </section>

      {/* Demo */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <Eyebrow>샘플</Eyebrow>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-tight mb-3">
            실제 주문 화면을 확인해보세요.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-muted-foreground mb-12 max-w-xl">
            깔끔하고 직관적인 모바일 우선 디자인.
          </p>

          <div className="grid sm:grid-cols-[auto_1fr] gap-10 sm:gap-14 items-center">
            {/* Phone Mockup */}
            <div className="mx-auto">
              <div className="relative w-[260px] h-[520px] rounded-[2.75rem] bg-foreground p-2.5 shadow-warm-lg">
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-foreground rounded-b-2xl z-10" />
                <div className="w-full h-full rounded-[2.25rem] overflow-hidden bg-background flex flex-col">
                  <div className="h-12 border-b border-border flex items-center justify-center gap-1.5">
                    <span className="text-[13px]">🍗</span>
                    <p className="text-[12px] font-bold tracking-tight">샘플 치킨집</p>
                  </div>
                  <div className="flex-1 p-3 space-y-2 overflow-hidden">
                    {[
                      { name: "후라이드치킨", price: "18,000", emoji: "🍗" },
                      { name: "양념치킨", price: "19,000", emoji: "🌶️" },
                      { name: "반반치킨", price: "19,000", emoji: "🥢" },
                    ].map((m) => (
                      <div
                        key={m.name}
                        className="flex items-center gap-2.5 p-2 rounded-xl border border-border bg-card"
                      >
                        <div className="size-10 rounded-lg bg-primary-light flex items-center justify-center text-lg shrink-0">
                          {m.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold truncate">{m.name}</p>
                          <p className="text-[11px] text-primary font-semibold tabular-nums">
                            {m.price}원
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-border">
                    <div className="h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[12px] font-semibold">
                      주문하기
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ul className="space-y-4 text-[15px]">
              {[
                "카테고리별 메뉴 정리",
                "원클릭 수량 조절",
                "모바일 최적화 디자인",
                "카카오 로그인 지원",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-foreground">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    check_circle
                  </span>
                  {f}
                </li>
              ))}
              <li className="pt-3">
                <Link
                  to={DEMO_STORE}
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full border border-border bg-card text-foreground text-[14px] font-semibold tracking-tight hover:bg-secondary hover:-translate-y-0.5 transition-all shadow-warm"
                >
                  <span className="material-symbols-outlined text-[18px]">touch_app</span>
                  데모 체험하기
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-24">
          <Eyebrow>자주 묻는 질문</Eyebrow>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-tight leading-tight mb-10">
            궁금한 점이 있으신가요?
          </h2>
          <div className="space-y-3">
            {[
              {
                q: "결제는 어떻게 받나요?",
                a: "고객이 가게에 방문해서 포장 음식을 받을 때 현장에서 직접 결제합니다. 현금, 카드, 계좌이체 등 사장님이 원하시는 방식으로. pojang.one은 주문 접수만 담당합니다.",
              },
              {
                q: "카카오톡 채널이 꼭 필요한가요?",
                a: "채널 없이 주문 페이지 URL만으로 운영 가능합니다. 다만 채널 연동 시 재방문 유도·이벤트 발송 등 마케팅이 가능합니다. 베타 기간에는 채널 개설도 대행해 드립니다.",
              },
              {
                q: "주문 알림은 어떻게 받나요?",
                a: "새 주문 발생 시 등록한 전화번호로 알림톡이 발송됩니다. 주문 관리 페이지에서 실시간 확인이 가능하고, 주문 확인·준비완료 시 고객에게도 자동 알림이 갑니다.",
              },
              {
                q: "해지는 어떻게 하나요?",
                a: "약정 없이 언제든 해지 가능합니다. 설정 페이지에서 직접 해지하거나 고객센터로 연락주시면 됩니다. 이미 결제된 기간은 끝까지 이용하실 수 있습니다.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border bg-card px-5 shadow-warm open:shadow-warm-lg transition-shadow"
              >
                <summary className="flex items-center justify-between py-5 cursor-pointer list-none">
                  <span className="text-[15px] font-semibold text-foreground tracking-tight">
                    {item.q}
                  </span>
                  <span className="material-symbols-outlined text-primary group-open:rotate-180 transition-transform text-[22px]">
                    expand_more
                  </span>
                </summary>
                <p className="pb-5 text-[14px] text-muted-foreground leading-relaxed pr-6">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-secondary/40 border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[320px] bg-[radial-gradient(60%_80%_at_50%_120%,rgba(238,124,43,0.18),transparent_70%)]"
        />
        <div className="relative max-w-3xl mx-auto px-5 py-20 sm:py-28 text-center">
          <span className="text-[40px]">🏮</span>
          <h2 className="text-[28px] sm:text-[38px] font-extrabold tracking-tight leading-tight mt-3 mb-4">
            오늘부터 우리 가게,
            <br />
            <span className="text-primary">포장 주문</span> 받아보세요.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-muted-foreground mb-8 max-w-xl mx-auto">
            복잡한 설정 없이 10분이면 내 가게 주문 페이지가 완성됩니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/join"
              className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-primary text-primary-foreground text-[15px] font-semibold tracking-tight shadow-glow hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
            >
              무료로 시작하기
            </Link>
            <a
              href="tel:010-1234-5678"
              className="inline-flex items-center justify-center gap-1.5 h-12 px-7 rounded-full border border-border bg-card text-foreground text-[15px] font-semibold tracking-tight hover:bg-secondary hover:-translate-y-0.5 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              문의하기
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[20px]">🏮</span>
              <div>
                <p className="text-[14px] font-bold tracking-tight">
                  pojang<span className="text-primary">.one</span>
                </p>
                <p className="text-[12px] text-muted-foreground">포장주문 전용 서비스</p>
              </div>
            </div>
            <div className="flex gap-5 text-[13px] text-muted-foreground">
              <Link to="/terms" className="hover:text-foreground transition-colors">
                이용약관
              </Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                개인정보처리방침
              </Link>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6">
            <p className="text-[12px] text-muted-foreground tabular-nums">
              © 2025 pojang.one. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 mb-4 text-[13px] font-bold text-primary tracking-tight">
      <span className="h-px w-6 bg-primary/40" />
      {children}
    </p>
  );
}
