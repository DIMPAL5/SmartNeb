import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { getProfile, updateProfile } from "@/lib/smartneb.functions";
import { isLanguage, useLanguage, LANGUAGES, LANGUAGE_LABELS, type Language } from "@/i18n";
import { useSignedIn } from "./use-signed-in";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Applies the language stored on the signed-in user's profile (once per session). */
export function useProfileLanguageSync() {
  const signedIn = useSignedIn();
  const { language, setLanguage } = useLanguage();
  const applied = useRef(false);
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    enabled: signedIn === true,
    retry: false,
  });

  useEffect(() => {
    if (applied.current || !data) return;
    const remote = (data as { language?: string | null }).language;
    applied.current = true;
    if (isLanguage(remote) && remote !== language) setLanguage(remote);
  }, [data, language, setLanguage]);
}

function persist(language: Language) {
  void updateProfile({ data: { language } }).catch(() => undefined);
}

export function LanguageSelect({
  className,
  withIcon = false,
}: {
  className?: string;
  withIcon?: boolean;
}) {
  const { language, setLanguage, t } = useLanguage();
  const signedIn = useSignedIn();

  return (
    <Select
      value={language}
      onValueChange={(value) => {
        if (!isLanguage(value)) return;
        setLanguage(value);
        if (signedIn === true) persist(value);
      }}
    >
      <SelectTrigger className={className} aria-label={t("language.label")}>
        {withIcon ? <Languages className="size-4 shrink-0" aria-hidden /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((code) => (
          <SelectItem key={code} value={code}>
            {LANGUAGE_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
