// routes/privacy.tsx
import type { Route } from "./+types/privacy";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "개인정보 처리방침 | 포장주문" },
    { name: "description", content: "포장주문 서비스의 개인정보 처리방침입니다." },
  ];
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보 처리방침</h1>

        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          <p className="text-gray-600 text-sm">
            시행일: 2024년 1월 1일 | 최종 수정일: 2024년 1월 1일
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">1. 개인정보의 수집 및 이용 목적</h2>
            <p className="text-gray-700 leading-relaxed">
              포장주문 서비스(이하 "서비스")는 다음의 목적을 위하여 개인정보를 처리합니다.
              처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
              이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>주문 접수 및 처리</li>
              <li>픽업 시간 안내 및 주문 상태 알림</li>
              <li>고객 문의 응대 및 서비스 개선</li>
              <li>서비스 이용 통계 및 분석</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">2. 수집하는 개인정보 항목</h2>
            <p className="text-gray-700 leading-relaxed">서비스는 다음의 개인정보 항목을 수집합니다:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>필수 항목:</strong> 휴대폰 번호</li>
              <li><strong>자동 수집 항목:</strong> 접속 IP, 쿠키, 접속 일시, 서비스 이용 기록</li>
              <li><strong>카카오 로그인 시:</strong> 카카오 계정 식별자, 이메일(선택)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">3. 개인정보의 보유 및 이용 기간</h2>
            <p className="text-gray-700 leading-relaxed">
              서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에
              동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>주문 정보:</strong> 주문 완료 후 5년 (전자상거래법)</li>
              <li><strong>접속 기록:</strong> 3개월 (통신비밀보호법)</li>
              <li><strong>회원 탈퇴 시:</strong> 즉시 삭제 (단, 법령에 따른 보존 의무가 있는 경우 해당 기간 동안 보존)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">4. 개인정보의 제3자 제공</h2>
            <p className="text-gray-700 leading-relaxed">
              서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
              다만, 아래의 경우에는 예외로 합니다:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">5. 개인정보의 파기</h2>
            <p className="text-gray-700 leading-relaxed">
              서비스는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체없이 해당 개인정보를 파기합니다.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>전자적 파일:</strong> 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
              <li><strong>종이 문서:</strong> 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">6. 정보주체의 권리·의무 및 행사방법</h2>
            <p className="text-gray-700 leading-relaxed">
              이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              위 권리 행사는 서비스 내 설정 메뉴 또는 개인정보 보호책임자에게 연락하여 행사할 수 있습니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">7. 쿠키의 사용</h2>
            <p className="text-gray-700 leading-relaxed">
              서비스는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 쿠키(Cookie)를 사용합니다.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>쿠키의 목적:</strong> 로그인 상태 유지, 서비스 이용 설정 저장</li>
              <li><strong>쿠키 거부 방법:</strong> 브라우저 설정에서 쿠키 저장을 거부할 수 있습니다. 단, 쿠키 저장을 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">8. 개인정보 보호책임자</h2>
            <p className="text-gray-700 leading-relaxed">
              서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고,
              개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여
              아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="text-gray-700"><strong>개인정보 보호책임자</strong></p>
              <p className="text-gray-600 mt-2">이메일: privacy@pojang.one</p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">9. 개인정보 처리방침 변경</h2>
            <p className="text-gray-700 leading-relaxed">
              이 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가,
              삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <span>홈으로 돌아가기</span>
          </a>
        </div>
      </div>
    </div>
  );
}
