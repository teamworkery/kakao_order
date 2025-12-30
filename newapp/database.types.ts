// 이 파일은 Supabase의 타입 정의 파일입니다.
// Supabase 프로젝트의 타입을 생성하려면 다음 명령어를 실행하세요:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > database.types.ts

// 임시 타입 정의 (실제 사용 시 Supabase에서 생성한 타입으로 교체해야 합니다)
export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
};





