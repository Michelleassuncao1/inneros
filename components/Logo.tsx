import Image from "next/image";
import logo from "@/assets/logo-ima-provisoire.png";

// Logo circulaire cerclé d'or, jamais déformé ni recoloré (charte, section 4)
export function Logo({ alt, size = 56 }: { alt: string; size?: number }) {
  return (
    <Image
      src={logo}
      alt={alt}
      width={size}
      height={size}
      priority
      className="rounded-full"
    />
  );
}
