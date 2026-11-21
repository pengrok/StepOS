import type { AnchorHTMLAttributes } from "react";
import { navigate } from "./navigation";

// next/link 대체
export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...rest}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
