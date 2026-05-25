import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "@/hooks/usePagination";

describe("usePagination", () => {
  it("يبدأ بصفحة 1 و total 0", () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.page).toBe(1);
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(1);
  });

  it("يحدّث totalPages بعد تعيين total", () => {
    const { result } = renderHook(() => usePagination(1, 10));
    act(() => result.current.setTotal(50));
    expect(result.current.totalPages).toBe(5);
    expect(result.current.from).toBe(1);
    expect(result.current.to).toBe(10);
  });

  it("ينتقل للصفحة التالية", () => {
    const { result } = renderHook(() => usePagination(1, 10));
    act(() => result.current.setTotal(50));
    act(() => result.current.next());
    expect(result.current.page).toBe(2);
  });

  it("لا يتجاوز totalPages", () => {
    const { result } = renderHook(() => usePagination(1, 10));
    act(() => result.current.setTotal(50));
    act(() => result.current.goTo(10));
    expect(result.current.page).toBe(5);
  });

  it("hasNext / hasPrev صحيحين", () => {
    const { result } = renderHook(() => usePagination(1, 10));
    act(() => result.current.setTotal(30));
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(false);
    act(() => result.current.goTo(3));
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(false);
  });
});
