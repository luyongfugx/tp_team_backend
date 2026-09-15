export type DatePreset = "today" | "yesterday" | "week" | "month";
export function galleryDatePreset(
  preset: DatePreset,
  now = new Date(),
  weekStart = 1,
) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (preset === "week")
    start.setDate(start.getDate() - ((start.getDay() - weekStart + 7) % 7));
  if (preset === "month") start.setDate(1);
  const format = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: format(start), to: format(end) };
}
