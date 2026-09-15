// Some uploads store a missing-address placeholder as the location text.
// Keep the original record intact; suppress only exact placeholders in the UI.
export function locationLabel(value: string | null | undefined): string | null {
  const label = value?.trim();
  if (!label) return null;
  if (
    /^(?:未设置(?:位置)+|未設定(?:位置)+|暂无地点|暫無地點|no location|location not set)$/i.test(
      label,
    )
  )
    return null;
  return label;
}
