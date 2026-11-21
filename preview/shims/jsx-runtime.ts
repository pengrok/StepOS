// react/jsx-runtime 대체: 자동 JSX 변환 결과를 UMD React의 createElement로 넘긴다
const R = (window as unknown as { React: typeof import("react") }).React;
type Props = Record<string, unknown> | null;
export const jsx = (type: Parameters<typeof R.createElement>[0], props: Props, key?: string) =>
  R.createElement(type, key === undefined ? props : { ...props, key });
export const jsxs = jsx;
export const Fragment = R.Fragment;
