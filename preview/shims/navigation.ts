// next/navigation 대체: 페이지 이동 대신 미리보기 앱의 화면 전환을 호출한다
let handler: (url: string) => void = () => {};
export const setNavigate = (h: (url: string) => void) => {
  handler = h;
};
export const navigate = (url: string) => handler(url);
export function useRouter() {
  return { push: navigate, replace: navigate, back: () => navigate("/") };
}
