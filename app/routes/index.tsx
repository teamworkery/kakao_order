import { Link } from "react-router";
import { Button } from "~/common/components/ui/button";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-orange-100/50" />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          {/* Logo */}
          <div className="mb-8">
            <span className="text-4xl font-black text-primary tracking-tight">
              POJANG.ONE
            </span>
            <p className="text-gray-500 text-sm mt-1">포장주문 전용 서비스</p>
          </div>

          {/* Pain Point - Main Hook */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
              우리 가게 단골 포장 손님,
              <br />
              <span className="text-primary">아직도 수수료 내고 계세요?</span>
            </h1>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">
              배달앱 수수료 없이, 내 가게만의 포장 주문 페이지를
              <br className="hidden sm:block" />
              <strong className="text-gray-900">월 10,000원</strong>으로 운영하세요.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Link to="/join">
              <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg font-bold shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all">
                무료로 시작하기
              </Button>
            </Link>
            <Link to="/sample">
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-lg font-bold border-2">
                샘플 페이지 보기
              </Button>
            </Link>
          </div>

          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
              설치비 무료
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
              주문 수수료 0%
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
              즉시 개설
            </span>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            혹시 이런 고민 있으신가요?
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-red-400">trending_down</span>
              </div>
              <h3 className="font-bold text-lg mb-2">배달앱 수수료 부담</h3>
              <p className="text-gray-400 text-sm">
                주문당 수수료가 쌓이면<br />한 달에 수십만원
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-yellow-400">phone_missed</span>
              </div>
              <h3 className="font-bold text-lg mb-2">전화 주문 불편</h3>
              <p className="text-gray-400 text-sm">
                바쁜 시간에 전화 받기 힘들고<br />주문 실수도 생기고
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-blue-400">person_off</span>
              </div>
              <h3 className="font-bold text-lg mb-2">단골 관리 어려움</h3>
              <p className="text-gray-400 text-sm">
                한번 온 손님을<br />다시 부르기 어려워요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block bg-primary/10 text-primary font-bold px-4 py-1 rounded-full text-sm mb-4">
              POJANG.ONE 솔루션
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              포장 주문, 이렇게 바뀝니다
            </h2>
            <p className="text-gray-600">
              복잡한 배달앱 없이, 내 가게 전용 주문 페이지로 간편하게
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="group bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl text-primary">storefront</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">내 가게 전용 주문 페이지</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                pojang.one/가게이름 형태의 깔끔한 주문 페이지가 생성됩니다.
                메뉴 등록부터 주문 관리까지 한 곳에서.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-gradient-to-br from-yellow-50 to-white border border-yellow-100 rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl text-yellow-600">chat</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">카카오톡 채널 연동</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                카카오톡 채널의 '주문하기' 버튼과 연결됩니다.
                고객은 익숙한 카카오톡에서 바로 주문!
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl text-green-600">notifications_active</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">실시간 주문 알림</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                새 주문이 들어오면 사장님 핸드폰으로 바로 알림!
                주문 확인, 준비완료 알림까지 자동으로.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl text-blue-600">loyalty</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">단골 고객 관리</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                카카오 채널 친구에게 이벤트 쿠폰, 비오는 날 할인 등
                맞춤 메시지로 재방문을 유도하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              이용 방법은 간단해요
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mb-3">
                1
              </div>
              <h3 className="font-bold text-gray-900 mb-1">회원가입</h3>
              <p className="text-gray-500 text-sm">카카오로 간편 가입</p>
            </div>

            <span className="material-symbols-outlined text-gray-300 text-3xl hidden sm:block">arrow_forward</span>
            <span className="material-symbols-outlined text-gray-300 text-3xl sm:hidden rotate-90">arrow_forward</span>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mb-3">
                2
              </div>
              <h3 className="font-bold text-gray-900 mb-1">가게 정보 입력</h3>
              <p className="text-gray-500 text-sm">메뉴와 가격 등록</p>
            </div>

            <span className="material-symbols-outlined text-gray-300 text-3xl hidden sm:block">arrow_forward</span>
            <span className="material-symbols-outlined text-gray-300 text-3xl sm:hidden rotate-90">arrow_forward</span>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mb-3">
                3
              </div>
              <h3 className="font-bold text-gray-900 mb-1">주문 받기</h3>
              <p className="text-gray-500 text-sm">바로 운영 시작!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              투명한 요금제
            </h2>
            <p className="text-gray-600">
              숨겨진 비용 없이, 딱 월 이용료만
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-gradient-to-br from-primary to-orange-600 text-white rounded-3xl p-8 shadow-2xl shadow-orange-500/30 relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <div className="text-center mb-6">
                  <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">
                    월 구독
                  </span>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-black">10,000</span>
                    <span className="text-xl">원</span>
                  </div>
                  <p className="text-white/80 mt-2">/ 월</p>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-green-300">check_circle</span>
                    <span>주문 수수료 <strong>0%</strong></span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-green-300">check_circle</span>
                    <span>전용 주문 페이지</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-green-300">check_circle</span>
                    <span>카카오톡 채널 연동</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-green-300">check_circle</span>
                    <span>실시간 주문 알림</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-green-300">check_circle</span>
                    <span>무제한 메뉴 등록</span>
                  </div>
                </div>

                <Link to="/join" className="block">
                  <Button size="lg" variant="secondary" className="w-full py-6 text-lg font-bold bg-white text-primary hover:bg-gray-100">
                    지금 시작하기
                  </Button>
                </Link>
              </div>
            </div>

            {/* Comparison note */}
            <div className="mt-8 bg-gray-100 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calculate</span>
                수수료 비교해보세요
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                배달앱 수수료가 주문당 평균 15%라면,<br />
                월 <strong>100만원</strong> 매출 기준 <strong>15만원</strong>이 수수료로 나갑니다.<br />
                <br />
                POJANG.ONE은 아무리 많이 팔아도<br />
                <strong className="text-primary">월 1만원</strong>만 내면 됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Launch Event Banner */}
      <section className="py-16 bg-gradient-to-r from-yellow-400 via-orange-500 to-primary">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <span className="inline-block bg-white/20 backdrop-blur px-4 py-1 rounded-full text-sm font-bold mb-4">
            출시기념 이벤트
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            베타서비스 기간 한정 혜택
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <div className="bg-white/20 backdrop-blur rounded-xl px-6 py-4">
              <p className="text-sm opacity-90">1개월 결제 시</p>
              <p className="text-xl font-bold">3개월 이용</p>
            </div>
            <span className="text-3xl">+</span>
            <div className="bg-white/20 backdrop-blur rounded-xl px-6 py-4">
              <p className="text-sm opacity-90">카카오채널 개설 대행</p>
              <p className="text-xl font-bold">무료 <span className="text-sm line-through opacity-70">(정가 3만원)</span></p>
            </div>
          </div>
          <p className="text-white/80 mb-6">선착순 5팀 한정</p>
          <Link to="/join">
            <Button size="lg" variant="secondary" className="px-8 py-6 text-lg font-bold bg-white text-primary hover:bg-gray-100 shadow-xl">
              이벤트 신청하기
            </Button>
          </Link>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              샘플 페이지를 확인해보세요
            </h2>
            <p className="text-gray-600">
              실제 주문 페이지가 어떻게 보이는지 미리 체험해보세요
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            {/* Phone Mockup */}
            <div className="relative">
              <div className="w-64 h-[500px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-b from-gray-100 to-white flex flex-col items-center justify-center p-6">
                    <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">restaurant_menu</span>
                    <p className="text-gray-500 text-sm text-center">
                      샘플 페이지 보기 버튼을<br />클릭하여 확인하세요
                    </p>
                  </div>
                </div>
              </div>
              {/* Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-gray-900 rounded-b-xl" />
            </div>

            <div className="text-center sm:text-left">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                깔끔하고 직관적인 주문 화면
              </h3>
              <ul className="space-y-3 text-gray-600 mb-6">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check</span>
                  카테고리별 메뉴 정리
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check</span>
                  원클릭 수량 조절
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check</span>
                  모바일 최적화 디자인
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check</span>
                  카카오 로그인 지원
                </li>
              </ul>
              <Link to="/sample">
                <Button size="lg" className="px-8">
                  샘플 페이지 보기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              자주 묻는 질문
            </h2>
          </div>

          <div className="space-y-4">
            <details className="group bg-gray-50 rounded-2xl">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                <span className="font-bold text-gray-900">결제는 어떻게 받나요?</span>
                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                고객이 가게에 방문해서 포장 음식을 받을 때 현장에서 직접 결제합니다.
                현금, 카드, 계좌이체 등 사장님이 원하시는 방식으로 받으시면 됩니다.
                저희 서비스는 주문 접수만 담당합니다.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-2xl">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                <span className="font-bold text-gray-900">카카오톡 채널이 꼭 필요한가요?</span>
                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                카카오톡 채널 없이도 주문 페이지 URL만으로 운영 가능합니다.
                하지만 카카오톡 채널과 연동하면 고객 재방문 유도, 이벤트 발송 등
                더 효과적인 마케팅이 가능합니다. 베타 기간에는 채널 개설도 대행해드려요!
              </div>
            </details>

            <details className="group bg-gray-50 rounded-2xl">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                <span className="font-bold text-gray-900">주문 알림은 어떻게 받나요?</span>
                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                새 주문이 들어오면 등록하신 전화번호로 알림톡이 발송됩니다.
                주문 관리 페이지에서 주문 현황을 실시간으로 확인할 수 있고,
                주문 확인/준비완료 시 고객에게도 자동 알림이 갑니다.
              </div>
            </details>

            <details className="group bg-gray-50 rounded-2xl">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                <span className="font-bold text-gray-900">해지는 어떻게 하나요?</span>
                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <div className="px-6 pb-6 text-gray-600">
                약정 기간 없이 언제든 해지 가능합니다.
                설정 페이지에서 직접 해지하시거나 고객센터로 연락주시면 됩니다.
                이미 결제된 기간은 끝까지 이용하실 수 있습니다.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            복잡한 설정 없이 10분이면 내 가게 주문 페이지가 완성됩니다.
            <br />
            배달앱 수수료 걱정 없이 포장 주문을 받아보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/join">
              <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg font-bold shadow-lg shadow-orange-500/30">
                무료로 시작하기
              </Button>
            </Link>
            <a href="tel:010-1234-5678">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg font-bold border-gray-600 text-gray-300 hover:bg-gray-800">
                <span className="material-symbols-outlined mr-2">call</span>
                문의하기
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div>
              <span className="text-xl font-bold text-white">POJANG.ONE</span>
              <p className="text-sm mt-1">포장주문 전용 서비스</p>
            </div>
            <div className="flex gap-6 text-sm">
              <Link to="/terms" className="hover:text-white transition-colors">이용약관</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">개인정보처리방침</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2025 POJANG.ONE. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
