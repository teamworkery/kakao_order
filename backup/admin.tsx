import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Form, useLoaderData } from "react-router";
import type { Database } from "database.types";
import { browserClient, makeSSRClient } from "~/supa_clients";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "./+types/admin";

type MenuItem = Database["public"]["Tables"]["menuItem"]["Row"];
// 메뉴 데이터 타입

// --- 1. loader: 메뉴 전체 조회 (비활성 포함)
export const getadminMenuItems = async (
  client: SupabaseClient<Database>,
  profile_id: string
) => {
  const { data, error } = await client
    .from("menuItem")
    .select("*")
    .eq("profile_id", profile_id)
    .order("createdAt", { ascending: true });

  if (error) {
    return [];
  }
  return data ?? [];
};

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { client } = makeSSRClient(request);
  const { data: userData } = await client.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    throw redirect("/login");
  }

  const menuItems = await getadminMenuItems(client, userId);

  let userProfile = null;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("profile_id", userId)
    .single();

  if (!error && data) {
    userProfile = data;
  }

  return { menuItems, userProfile };
};

// --- 2. action: 메뉴 추가/수정/삭제 (type별 처리)
export async function action({ request }: ActionFunctionArgs) {
  const { client } = makeSSRClient(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const price = Number(formData.get("price"));
  const image = formData.get("image") as string;
  const isActive = formData.get("isActive") === "true";
  const category = formData.get("category") as string;

  if (actionType === "logout") {
    await client.auth.signOut();
    return redirect("/login");
  }

  if (actionType === "add") {
    const { data: userData } = await client.auth.getUser();
    const profile_id = userData?.user?.id;
    await client
      .from("menuItem")
      .insert([
        { name, description, price, image, isActive, category, profile_id },
      ]);
  } else if (actionType === "edit") {
    await client
      .from("menuItem")
      .update({
        name,
        description,
        price,
        image,
        isActive,
        category,
      })
      .eq("id", id);
  } else if (actionType === "delete") {
    await client.from("menuItem").delete().eq("id", id);
  }
  return redirect("/admin"); // 경로 맞게 수정
}

// --- 3. 이미지 업로드 컴포넌트
function ImageUploadInput({
  value,
  onChange,
  setUploading,
}: {
  value: string;
  onChange: (url: string) => void;
  setUploading: (uploading: boolean) => void;
}) {
  const [uploading, setLocalUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    console.log("uploading", uploading);
    const supabase = browserClient;

    const ext = file.name.split(".").pop();
    const filename = `menu_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      setError("업로드 실패: " + uploadError.message);
      setUploading(false);
      return;
    }
    // public url 생성
    const { publicUrl } = supabase.storage
      .from("menu-images")
      .getPublicUrl(filename).data;
    onChange(publicUrl);
    setUploading(false);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <p className="text-sm text-gray-500">업로드 중...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {value && (
        <img
          src={value}
          alt="미리보기"
          className="mt-2 w-28 h-20 object-cover rounded"
        />
      )}
    </div>
  );
}

// --- 4. 관리자 메뉴 관리 컴포넌트
export default function AdminMenuPage() {
  const { menuItems, userProfile } = useLoaderData<typeof loader>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [addImageUploading, setAddImageUploading] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    isActive: "true",
    category: "",
  });

  // 추가 폼 핸들러
  const handleAddChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setAddForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleAddImageUpload = (url: string) => {
    setAddForm((prev) => ({ ...prev, image: url }));
  };

  // 수정 폼 핸들러
  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };
  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleEditImageUpload = (url: string) => {
    setEditForm((prev) => ({ ...prev, image: url }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        {/* 타이틀 + 유저 정보 + 로그아웃 */}
        <div className="bg-white shadow-lg rounded-2xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🍴 메뉴 관리</h1>
            {userProfile && (
              <p className="text-sm text-gray-500 mt-1">
                관리자:{" "}
                <span className="font-semibold">{userProfile.email}</span>
              </p>
            )}
          </div>
          <Form method="post">
            <input type="hidden" name="actionType" value="logout" />
            <button
              type="submit"
              className="bg-gray-400 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              로그아웃
            </button>
          </Form>
        </div>

        {/* 메뉴 추가 폼 */}
        <div className="bg-white shadow-md rounded-2xl px-8 py-6">
          <Form
            method="post"
            className="flex flex-wrap gap-3 items-end"
            onSubmit={(e) => {
              if (addImageUploading) {
                e.preventDefault();
                alert("이미지 업로드가 완료될 때까지 기다려주세요.");
              }
              if (!addForm.image) {
                e.preventDefault();
                alert("이미지 업로드를 완료해주세요.");
              }
            }}
          >
            <input name="actionType" type="hidden" value="add" />
            <div>
              <input
                name="name"
                required
                placeholder="이름"
                value={addForm.name}
                onChange={handleAddChange}
                className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <input
                name="description"
                placeholder="설명"
                value={addForm.description}
                onChange={handleAddChange}
                className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <input
                name="price"
                required
                type="number"
                min={0}
                placeholder="가격"
                value={addForm.price}
                onChange={handleAddChange}
                className="border border-gray-300 px-3 py-2 rounded-lg w-24 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <ImageUploadInput
                value={addForm.image}
                onChange={handleAddImageUpload}
                setUploading={setAddImageUploading}
              />
              <input type="hidden" name="image" value={addForm.image} />
            </div>
            <div>
              <select
                name="isActive"
                value={addForm.isActive}
                onChange={handleAddChange}
                className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </div>
            <div>
              <input
                name="category"
                placeholder="카테고리"
                value={addForm.category}
                onChange={handleAddChange}
                className="border border-gray-300 px-3 py-2 rounded-lg w-28 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
              disabled={addImageUploading || !addForm.image}
            >
              추가
            </button>
          </Form>
        </div>

        {/* 메뉴 목록 */}
        {/* 메뉴 목록 */}
        <div className="bg-white shadow-md rounded-2xl px-4 py-6 overflow-x-auto">
          <div role="table" className="w-full min-w-[800px]">
            {/* 헤더 */}
            <div
              role="row"
              className="flex font-semibold bg-gray-100 text-gray-700 px-2 py-2"
            >
              <div role="columnheader" className="w-1/6">
                이름
              </div>
              <div role="columnheader" className="w-1/4">
                설명
              </div>
              <div role="columnheader" className="w-1/12">
                가격
              </div>
              <div role="columnheader" className="w-1/6">
                이미지
              </div>
              <div role="columnheader" className="w-1/12">
                상태
              </div>
              <div role="columnheader" className="w-1/4">
                관리
              </div>
            </div>

            {/* 항목들 */}
            {menuItems.map((item: MenuItem) =>
              editingId === item.id ? (
                <Form
                  key={item.id}
                  method="post"
                  className="flex border-b last:border-b-0 items-center px-2 py-2 w-full"
                >
                  <input type="hidden" name="actionType" value="edit" />
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="image"
                    value={editForm.image || ""}
                  />
                  <div className="w-1/6">
                    <input
                      name="name"
                      value={editForm.name || ""}
                      onChange={handleEditChange}
                      className="border px-2 py-1 rounded-lg w-full"
                    />
                  </div>
                  <div className="w-1/4">
                    <input
                      name="description"
                      value={editForm.description || ""}
                      onChange={handleEditChange}
                      className="border px-2 py-1 rounded-lg w-full"
                    />
                  </div>
                  <div className="w-1/12">
                    <input
                      name="price"
                      type="number"
                      value={editForm.price || 0}
                      onChange={handleEditChange}
                      className="border px-2 py-1 rounded-lg w-full"
                    />
                  </div>
                  <div className="w-1/6">
                    <ImageUploadInput
                      value={editForm.image || ""}
                      onChange={handleEditImageUpload}
                      setUploading={setAddImageUploading}
                    />
                  </div>
                  <div className="w-1/12">
                    <select
                      name="isActive"
                      value={editForm.isActive ? "true" : "false"}
                      onChange={handleEditChange}
                      className="border px-2 py-1 rounded-lg w-full"
                    >
                      <option value="true">활성</option>
                      <option value="false">비활성</option>
                    </select>
                  </div>
                  <div className="w-1/4 flex gap-1">
                    <input
                      type="hidden"
                      name="category"
                      value={editForm.category || ""}
                    />
                    <button
                      type="submit"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-xl transition-colors"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-xl transition-colors"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </button>
                  </div>
                </Form>
              ) : (
                <div
                  key={item.id}
                  role="row"
                  className="flex border-b last:border-b-0 items-center px-2 py-2"
                >
                  <div role="cell" className="w-1/6">
                    {item.name}
                  </div>
                  <div role="cell" className="w-1/4">
                    {item.description}
                  </div>
                  <div role="cell" className="w-1/12">
                    {item.price}원
                  </div>
                  <div role="cell" className="w-1/6">
                    {item.image && (
                      <img
                        src={item.image}
                        alt="menu"
                        className="w-16 h-12 object-cover rounded"
                      />
                    )}
                  </div>
                  <div role="cell" className="w-1/12">
                    {item.isActive ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                        활성
                      </span>
                    ) : (
                      <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs">
                        비활성
                      </span>
                    )}
                  </div>
                  <div role="cell" className="w-1/4 flex gap-1">
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-xl transition-colors"
                      onClick={() => startEdit(item)}
                    >
                      수정
                    </button>
                    <Form method="post" className="inline">
                      <input type="hidden" name="actionType" value="delete" />
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-xl transition-colors"
                        onClick={(e) => {
                          if (!confirm("정말 삭제하시겠습니까?"))
                            e.preventDefault();
                        }}
                      >
                        삭제
                      </button>
                    </Form>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
