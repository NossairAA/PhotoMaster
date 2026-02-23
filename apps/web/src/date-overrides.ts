export type DateMode = "keep-original" | "now" | "custom";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatExifDateTime(date: Date) {
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDateTimeLocalToExif(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [datePart, timePart = "00:00"] = trimmed.split("T");
  if (!datePart) return null;

  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return null;

  const [hour = "00", minute = "00", second = "00"] = timePart.split(":");
  return `${year}:${month}:${day} ${hour}:${minute}:${second}`;
}

export function formatExifToDateTimeLocal(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const [datePart, timePart = "00:00:00"] = trimmed.split(" ");
  const [year, month, day] = datePart.split(":");
  if (!year || !month || !day) return "";
  const [hour = "00", minute = "00"] = timePart.split(":");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function buildDateOverride(mode: DateMode, customValue: string, nowDate: Date = new Date()) {
  if (mode === "keep-original") {
    return { value: "", error: null as string | null };
  }

  if (mode === "now") {
    return { value: formatExifDateTime(nowDate), error: null as string | null };
  }

  const converted = formatDateTimeLocalToExif(customValue);
  if (!converted) {
    return { value: "", error: "Pick a custom date before processing." };
  }

  return { value: converted, error: null as string | null };
}
