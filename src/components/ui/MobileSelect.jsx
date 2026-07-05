import React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const EMPTY_SENTINEL = "__empty_value__";

export default function MobileSelect({ value, onValueChange, options, triggerClassName, placeholder }) {
  const adjust = (v) => (v === "" || v === undefined || v === null) ? EMPTY_SENTINEL : String(v);
  const adjustedValue = adjust(value);
  const adjustedOptions = options.map(o => ({
    value: adjust(o.value),
    label: o.label
  }));

  return (
    <Select value={adjustedValue} onValueChange={v => onValueChange(v === EMPTY_SENTINEL ? "" : v)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {adjustedOptions.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}