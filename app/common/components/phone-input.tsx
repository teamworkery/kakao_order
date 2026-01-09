// 전화번호 입력 컴포넌트 - 자동 하이픈 포맷팅 및 유효성 검사
import { useState, useEffect, forwardRef } from "react";
import { cn } from "~/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  onValidChange?: (isValid: boolean) => void;
}

// 전화번호 포맷팅 함수 (010-1234-5678 형식)
export function formatPhoneNumber(value: string): string {
  // 숫자만 추출
  const numbers = value.replace(/\D/g, "");

  // 최대 11자리로 제한
  const limited = numbers.slice(0, 11);

  // 포맷팅
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 7) {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  } else {
    return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
  }
}

// 전화번호 유효성 검사
export function validatePhoneNumber(value: string): { isValid: boolean; message: string } {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length === 0) {
    return { isValid: false, message: "전화번호를 입력해주세요" };
  }

  if (numbers.length < 10) {
    return { isValid: false, message: "전화번호가 너무 짧습니다" };
  }

  if (numbers.length > 11) {
    return { isValid: false, message: "전화번호가 너무 깁니다" };
  }

  // 한국 휴대폰 번호 패턴 검사 (010, 011, 016, 017, 018, 019)
  const validPrefixes = ["010", "011", "016", "017", "018", "019"];
  const prefix = numbers.slice(0, 3);

  if (!validPrefixes.includes(prefix)) {
    return { isValid: false, message: "올바른 휴대폰 번호가 아닙니다" };
  }

  return { isValid: true, message: "" };
}

// 순수 숫자만 추출
export function getRawPhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "010-1234-5678",
      className,
      disabled = false,
      required = false,
      id,
      name,
      autoFocus = false,
      onValidChange,
    },
    ref
  ) => {
    const [isTouched, setIsTouched] = useState(false);
    const validation = validatePhoneNumber(value);

    // 유효성 변경 시 콜백 호출
    useEffect(() => {
      if (onValidChange) {
        onValidChange(validation.isValid);
      }
    }, [validation.isValid, onValidChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      onChange(formatted);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData("text");
      const formatted = formatPhoneNumber(pastedText);
      onChange(formatted);
    };

    const handleBlur = () => {
      setIsTouched(true);
    };

    const showError = isTouched && !validation.isValid && value.length > 0;

    return (
      <div className="w-full">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <span className="material-symbols-outlined text-[18px]">phone</span>
          </span>
          <input
            ref={ref}
            type="tel"
            inputMode="numeric"
            id={id}
            name={name}
            value={value}
            onChange={handleChange}
            onPaste={handlePaste}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            autoFocus={autoFocus}
            autoComplete="tel"
            className={cn(
              "w-full pl-10 pr-4 py-3 border rounded-lg text-base transition-colors",
              "focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
              showError
                ? "border-red-400 bg-red-50"
                : "border-gray-200 bg-white hover:border-gray-300",
              disabled && "opacity-50 cursor-not-allowed bg-gray-100",
              className
            )}
          />
          {/* 유효성 표시 아이콘 */}
          {value.length > 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {validation.isValid ? (
                <span className="material-symbols-outlined text-green-500 text-[20px]">
                  check_circle
                </span>
              ) : isTouched ? (
                <span className="material-symbols-outlined text-red-500 text-[20px]">
                  error
                </span>
              ) : null}
            </span>
          )}
        </div>
        {/* 에러 메시지 */}
        {showError && (
          <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">info</span>
            {validation.message}
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
