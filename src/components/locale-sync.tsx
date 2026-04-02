"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { setApiLocale } from "@/lib/api";

export function LocaleSync() {
  const locale = useLocale();

  useEffect(() => {
    setApiLocale(locale);
  }, [locale]);

  return null;
}
