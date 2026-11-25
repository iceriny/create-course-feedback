import type { ComponentPropsWithoutRef } from "react";

export default function Logo(props: ComponentPropsWithoutRef<"img">) {
  return <img {...props} src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />;
}
