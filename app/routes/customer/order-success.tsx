import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/order-success";
import { Button } from "~/common/components/ui/button";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  return {
    orderId: orderId || null,
  };
}

export default function OrderSuccessPage({
  loaderData,
}: Route.ComponentProps) {
  const { orderId } = loaderData;
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = searchParams.get("orderId") || orderId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            주문이 완료되었습니다!
          </h1>
          <p className="text-gray-600 mb-4">
            주문이 성공적으로 접수되었습니다.
            <br />
            음식점 확인 시 알림톡이 발송됩니다.
          </p>
          {orderIdFromUrl && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">주문번호</p>
              <p className="text-lg font-bold text-gray-900">{orderIdFromUrl}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Link to="/" className="block">
            <Button className="w-full" size="lg">
              홈으로 돌아가기
            </Button>
          </Link>
          <p className="text-xs text-gray-500">
            주문 내역은 마이페이지에서 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

