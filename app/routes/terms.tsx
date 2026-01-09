// routes/terms.tsx
import type { Route } from "./+types/terms";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "이용약관 | 포장주문" },
    { name: "description", content: "포장주문 서비스의 이용약관입니다." },
  ];
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">이용약관</h1>

        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          <p className="text-gray-600 text-sm">
            시행일: 2024년 1월 1일 | 최종 수정일: 2024년 1월 1일
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제1조 (목적)</h2>
            <p className="text-gray-700 leading-relaxed">
              본 약관은 포장주문 서비스(이하 "서비스")를 이용함에 있어
              서비스와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제2조 (정의)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>"서비스"</strong>란 이용자가 음식점에 포장 주문을 할 수 있도록 제공하는 온라인 플랫폼을 말합니다.</li>
              <li><strong>"이용자"</strong>란 본 약관에 따라 서비스를 이용하는 고객을 말합니다.</li>
              <li><strong>"가맹점"</strong>이란 서비스를 통해 주문을 받는 음식점을 말합니다.</li>
              <li><strong>"주문"</strong>이란 이용자가 가맹점에 음식을 요청하는 행위를 말합니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제3조 (약관의 효력 및 변경)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li>본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.</li>
              <li>서비스는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지합니다.</li>
              <li>변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단할 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제4조 (서비스의 제공)</h2>
            <p className="text-gray-700 leading-relaxed">서비스는 다음과 같은 기능을 제공합니다:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>가맹점 메뉴 조회</li>
              <li>포장 주문 접수</li>
              <li>주문 상태 확인</li>
              <li>픽업 시간 안내</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제5조 (이용자의 의무)</h2>
            <p className="text-gray-700 leading-relaxed">이용자는 다음 행위를 해서는 안 됩니다:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>허위 정보를 입력하거나 타인의 정보를 도용하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
              <li>다른 이용자 또는 가맹점에게 피해를 주는 행위</li>
              <li>법령 또는 공서양속에 위반되는 행위</li>
              <li>악의적으로 주문을 취소하거나 픽업하지 않는 행위</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제6조 (주문 및 결제)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li>주문은 이용자가 메뉴를 선택하고 주문을 완료한 시점에 성립됩니다.</li>
              <li>결제는 가맹점에서 픽업 시 현장에서 이루어집니다.</li>
              <li>주문 후에는 취소가 불가능하며, 부득이한 경우 가맹점에 직접 연락해야 합니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제7조 (픽업)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li>이용자는 가맹점에서 안내한 픽업 시간에 맞춰 방문해야 합니다.</li>
              <li>픽업 시간을 현저히 초과하는 경우, 가맹점은 주문을 취소할 수 있습니다.</li>
              <li>픽업하지 않은 주문에 대해서는 서비스가 책임지지 않습니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제8조 (서비스의 중단)</h2>
            <p className="text-gray-700 leading-relaxed">
              서비스는 다음과 같은 경우 서비스 제공을 일시적으로 중단할 수 있습니다:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>시스템 점검, 보수, 교체 등의 필요가 있는 경우</li>
              <li>천재지변, 국가비상사태 등 불가항력적인 사유가 발생한 경우</li>
              <li>기타 서비스 운영상 상당한 이유가 있는 경우</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제9조 (면책조항)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li>서비스는 이용자와 가맹점 간의 거래를 중개하는 역할만 하며, 거래에서 발생하는 분쟁에 대해서는 당사자 간에 해결해야 합니다.</li>
              <li>음식의 품질, 위생 상태 등에 대해서는 가맹점이 책임을 집니다.</li>
              <li>이용자의 귀책사유로 인해 발생한 손해에 대해서는 서비스가 책임지지 않습니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제10조 (분쟁 해결)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li>서비스 이용과 관련하여 분쟁이 발생한 경우, 당사자 간의 합의에 의해 해결합니다.</li>
              <li>합의가 이루어지지 않는 경우, 관련 법령에 따른 절차에 의해 해결합니다.</li>
              <li>본 약관에 명시되지 않은 사항은 관련 법령 및 상관례에 따릅니다.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">제11조 (회원 탈퇴 및 자격 상실)</h2>
            <ul className="list-decimal list-inside text-gray-700 space-y-2 ml-4">
              <li>이용자는 언제든지 서비스 내 설정 메뉴를 통해 탈퇴를 요청할 수 있습니다.</li>
              <li>탈퇴 시 이용자의 개인정보는 관련 법령에서 정한 보관 기간을 제외하고 즉시 삭제됩니다.</li>
              <li>이용자가 본 약관을 위반한 경우, 서비스는 이용자의 자격을 제한 또는 상실시킬 수 있습니다.</li>
            </ul>
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
