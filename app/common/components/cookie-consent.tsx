// components/cookie-consent.tsx
import { useState, useEffect } from "react";

const COOKIE_CONSENT_KEY = "cookie_consent";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 실행
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // 약간의 딜레이 후 표시 (페이지 로딩 후)
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* 아이콘 & 텍스트 */}
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <span className="material-symbols-outlined text-primary">
                  cookie
                </span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">쿠키 사용 안내</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  저희 서비스는 로그인 상태 유지 및 서비스 개선을 위해 쿠키를 사용합니다.
                  자세한 내용은{" "}
                  <a href="/privacy" className="text-primary hover:underline">
                    개인정보 처리방침
                  </a>
                  을 확인해주세요.
                </p>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              거부
            </button>
            <button
              onClick={handleAccept}
              className="px-6 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm"
            >
              동의
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
