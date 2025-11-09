"use client";

import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="absolute top-0 w-full flex items-center justify-center p-4 z-10">
      <Link href="/">
        <Image
          src="/logo.png"
          alt="V1 logo"
          width={60}
          quality={100}
          height={60}
        />
      </Link>
    </header>
  );
}
