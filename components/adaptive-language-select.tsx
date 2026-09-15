"use client";

import type { SelectHTMLAttributes } from "react";
import "./adaptive-language-select.css";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "children"> & {
  value: string;
  options: readonly { value: string; label: string }[];
};

export function AdaptiveLanguageSelect({ value, options, className = "", ...props }: Props) {
  const label = options.find(option => option.value === value)?.label || value;
  return (
    <div className={`tp-language-select ${className}`}>
      {/* Only the current label contributes width; the full option list does not. */}
      <span aria-hidden="true">{label}</span>
      <select {...props} value={value} title={label}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
