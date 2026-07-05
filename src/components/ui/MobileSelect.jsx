import React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const EMPTY_SENTINEL = "__empty_value__";

export default function MobileSelect({ value, onValueChange, options, triggerClassName, contentClassName, placeholder }) {
  const adjust = (v) => (v === "" || v === undefined || v === null) ? EMPTY_SENTINEL : String(v);
  const adjustedValue = adjust(value);
  const adjustedOptions = options.map(o => ({
    value: adjust(o.value),
    label: o.label
  }));

  return (
    <Select value={adjustedValue} onValueChange={v => onValueChange(v === EMPTY_SENTINEL ? "" : v)}>
      <SelectTrigger className={`bg-white text-gray-900 ${triggerClassName || ""}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName || "z-[10003] bg-white text-gray-900 border-gray-200"}>
        {adjustedOptions.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}