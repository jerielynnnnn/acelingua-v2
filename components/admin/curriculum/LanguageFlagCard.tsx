"use client";
import Image from "next/image";
import { Globe2 } from "lucide-react";
import { useState } from "react";
import type { CourseLanguage } from "@/lib/curriculum/course-creator";

export default function LanguageFlagCard({ language, selected, disabled, onSelect, groupName = "course-language" }: {
  language: CourseLanguage; selected: boolean; disabled?: boolean; onSelect: (code: string) => void; groupName?: string;
}) {
  const [failed, setFailed] = useState(false);
  return <label className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition motion-safe:hover:-translate-y-1 ${selected ? "border-[#3558AE] bg-[#eeeafd] shadow-md" : "border-white bg-white/80 hover:border-[#C7A9D4]"} ${disabled ? "pointer-events-none opacity-60" : ""} has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-[#3558AE]`}>
    <input type="radio" className="sr-only" name={groupName} value={language.code} checked={selected} disabled={disabled} onChange={() => onSelect(language.code)} />
    <span className="relative block aspect-[3/2] w-20 overflow-hidden rounded-md bg-white shadow-sm" aria-hidden="true">
      {failed ? <Globe2 className="m-auto h-full text-[#3558AE]" /> : <Image src={`/icons/flags/${language.country}.png`} alt="" fill sizes="80px" className="object-contain" onError={() => setFailed(true)} />}
    </span>
    <span className="font-bold">{language.name}</span><span className="text-sm text-slate-600">{language.nativeName}</span>
    {selected && <span className="text-xs font-bold text-[#3558AE]">Selected</span>}
  </label>;
}
