import { useState, useEffect } from "react";
import { redirect, Form } from "react-router";
import { makeSSRClient } from "~/supa_clients";
import type { Route } from "./+types/phone";
import type { Database } from "~/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "~/common/components/ui/button";
import { Input } from "~/common/components/ui/input";
import { Label } from "~/common/components/ui/label";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface PendingOrder {
  orderItems: OrderItem[];
  totalAmount: number;
  storeName: string;
  phoneNumber: string | null;
}

// saveOrder 함수를 재사용
const saveOrder = async (
  client: SupabaseClient<Database>,
  orderItems: OrderItem[],
  phoneNumber: string,
  totalAmount: number,
  profile_id: string
) => {
  // 1) 주문(order) 저장
  const { data: order, error: orderError } = await client
    .from("order")
    .insert([
      {
        phoneNumber,
        totalAmount,
        status: "PENDING",
        profile_id,
      },
    ])
    .select()
    .single();

  if (orderError || !order) {
    throw orderError || new Error("주문 저장 실패 (order 테이블)");
  }

  // 2) 주문 아이템(orderItem) 저장 (여러개)
  const orderItemRows = orderItems.map((item: OrderItem) => ({
    orderId: order.order_id,
    menuItemId: item.id,
    quantity: item.quantity,
    price: item.price,
  }));

  const { error: itemError } = await client
    .from("orderitem")
    .insert(orderItemRows);

  if (itemError) {
    throw itemError;
  }

  return order.order_id;
};

export async function loader({ request }: Route.LoaderArgs) {
  const { client } = makeSSRClient(request);
  const { data: userData } = await client.auth.getUser();

  if (!userData?.user) {
    throw redirect("/login");
  }

  // 프로필 확인
  const { data: profile } = await client
    .from("profiles")
    .select("profile_id, role, customernumber")
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  // 이미 전화번호가 있으면 메인으로 리다이렉트
  if (profile?.customernumber) {
    throw redirect("/");
  }

  return {
    userId: userData.user.id,
    hasPhoneNumber: !!profile?.customernumber,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { client, headers } = makeSSRClient(request);
  const { data: userData } = await client.auth.getUser();

  if (!userData?.user) {
    return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const phoneNumber = formData.get("phoneNumber") as string;

  if (!phoneNumber?.trim()) {
    return Response.json(
      { error: "전화번호를 입력해주세요." },
      { status: 400 }
    );
  }

  // 전화번호 형식 검증 (선택사항)
  const phoneRegex = /^[0-9-]+$/;
  if (!phoneRegex.test(phoneNumber.trim())) {
    return Response.json(
      { error: "올바른 전화번호 형식이 아닙니다." },
      { status: 400 }
    );
  }

  const userId = userData.user.id;

  // 프로필이 있는지 확인
  const { data: existingProfile } = await client
    .from("profiles")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (existingProfile) {
    // 기존 프로필 업데이트
    const { error } = await client
      .from("profiles")
      .update({
        customernumber: phoneNumber.trim(),
        role: "customer", // 확실하게 customer로 설정
      })
      .eq("profile_id", userId);

    if (error) {
      console.error("프로필 업데이트 오류:", error);
      return Response.json(
        { error: "전화번호 저장에 실패했습니다." },
        { status: 500 }
      );
    }
  } else {
    // 프로필이 없으면 생성 (callback에서 생성 실패한 경우 대비)
    const { error } = await client.from("profiles").insert([
      {
        profile_id: userId,
        email: userData.user.email,
        role: "customer",
        customernumber: phoneNumber.trim(),
      },
    ]);

    if (error) {
      console.error("프로필 생성 오류:", error);
      return Response.json(
        { error: "프로필 생성에 실패했습니다." },
        { status: 500 }
      );
    }
  }

  // 전화번호 저장 완료
  // 주문 자동 진행은 클라이언트 측에서 처리 (sessionStorage 접근)
  throw redirect("/customer/phone?phoneSaved=true", { headers });
}

export default function PhoneInputPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(
    actionData?.error || null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // 전화번호 저장 후 주문 자동 진행
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("phoneSaved") === "true") {
      // sessionStorage에서 주문 정보 확인
      const pendingOrderStr = sessionStorage.getItem("pendingOrder");
      if (pendingOrderStr) {
        try {
          const pendingOrder: PendingOrder = JSON.parse(pendingOrderStr);
          // 전화번호가 저장된 상태이므로 프로필에서 전화번호 가져오기
          processOrder(pendingOrder);
        } catch (e) {
          console.error("주문 정보 파싱 오류:", e);
          // 주문 정보가 없으면 메인으로 리다이렉트
          window.location.href = "/";
        }
      } else {
        // 주문 정보가 없으면 메인으로 리다이렉트
        window.location.href = "/";
      }
    }
  }, [phoneNumber]);

  const processOrder = async (orderData: PendingOrder) => {
    setIsProcessing(true);
    try {
      // 가게 프로필 찾기 (storeName으로)
      const storeName = orderData.storeName;
      
      // 주문 정보를 서버로 전송
      const formData = new FormData();
      formData.append("orderItems", JSON.stringify(orderData.orderItems));
      formData.append("totalAmount", String(orderData.totalAmount));
      // 전화번호는 프로필에 저장되어 있으므로, 주문 시에는 프로필에서 가져옴
      // 하지만 주문 API는 전화번호를 필요로 하므로, orderData의 phoneNumber 사용
      formData.append("phoneNumber", orderData.phoneNumber || phoneNumber || "");
      formData.append("autoOrder", "true"); // 자동 주문 플래그

      const orderResponse = await fetch(`/${storeName}`, {
        method: "POST",
        body: formData,
      });

      if (!orderResponse.ok) {
        throw new Error("주문 요청 실패");
      }

      const result = await orderResponse.json();

      if (result.success) {
        // 주문 성공 - sessionStorage 정리
        sessionStorage.removeItem("pendingOrder");
        // 주문 성공 페이지로 리다이렉트
        window.location.href = `/customer/order-success?orderId=${result.orderId}`;
      } else {
        setError(result.message || "주문 처리 중 오류가 발생했습니다.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("주문 처리 오류:", error);
      setError("주문 처리 중 오류가 발생했습니다.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        {isProcessing ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-2">주문 처리 중...</h1>
            <p className="text-gray-600">잠시만 기다려주세요.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">전화번호 입력</h1>
            <p className="text-gray-600 mb-6">
              주문을 위해 전화번호를 입력해주세요.
            </p>

            <Form method="post" className="space-y-4">
              <div>
                <Label htmlFor="phoneNumber">전화번호 *</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError(null);
                  }}
                  placeholder="010-1234-5678"
                  required
                  className="mt-1"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isProcessing}>
                저장하기
              </Button>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}

