// 미리보기 페이지는 React를 cdnjs UMD 전역(window.React)으로 불러온다
const R = (window as unknown as { React: typeof import("react") }).React;
export default R;
export const { useState, useEffect, useMemo, useCallback, useRef, Suspense, Fragment, createElement } = R;
