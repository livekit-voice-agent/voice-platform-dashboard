"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português",
  en: "English",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as Locale });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      <Select value={locale} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((loc) => (
            <SelectItem key={loc} value={loc} className="text-xs">
              {LOCALE_LABELS[loc]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
