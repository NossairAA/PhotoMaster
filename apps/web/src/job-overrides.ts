export type MetadataDraftInput = {
  dateTimeOriginal: string;
  gpsLatitude: string;
  gpsLongitude: string;
  locationLabel: string;
  cameraMake: string;
  cameraModel: string;
  lensModel: string;
  iso: string;
  focalLengthMm: string;
  exposureCompensationEv: string;
  apertureFNumber: string;
  shutterSpeed: string;
  imageWidth: string;
  imageHeight: string;
  megapixels: string;
  title: string;
  caption: string;
  keywordsText: string;
  author: string;
  copyright: string;
};

type BuildJobOverridesResult = {
  overrides: Record<string, unknown>;
  error: string | null;
};

function parseNumberField(params: {
  raw: string;
  label: string;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const trimmed = params.raw.trim();
  if (!trimmed) {
    return { present: false as const, value: null as number | null, error: null as string | null };
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return { present: true as const, value: null as number | null, error: `${params.label} must be a valid number.` };
  }

  if (params.integer && !Number.isInteger(numeric)) {
    return { present: true as const, value: null as number | null, error: `${params.label} must be an integer.` };
  }

  if (typeof params.min === "number" && numeric < params.min) {
    return {
      present: true as const,
      value: null as number | null,
      error: `${params.label} must be greater than or equal to ${params.min}.`,
    };
  }

  if (typeof params.max === "number" && numeric > params.max) {
    return {
      present: true as const,
      value: null as number | null,
      error: `${params.label} must be less than or equal to ${params.max}.`,
    };
  }

  return { present: true as const, value: numeric, error: null as string | null };
}

export function buildJobOverrides(params: MetadataDraftInput): BuildJobOverridesResult {
  const overrides: Record<string, unknown> = {};

  const textMappings: Array<[string, string]> = [
    ["dateTimeOriginal", params.dateTimeOriginal],
    ["locationLabel", params.locationLabel],
    ["cameraMake", params.cameraMake],
    ["cameraModel", params.cameraModel],
    ["lensModel", params.lensModel],
    ["shutterSpeed", params.shutterSpeed],
    ["title", params.title],
    ["caption", params.caption],
    ["author", params.author],
    ["copyright", params.copyright],
  ];

  for (const [field, value] of textMappings) {
    const trimmed = value.trim();
    if (trimmed) {
      overrides[field] = trimmed;
    }
  }

  const numericConfigs: Array<{
    field: string;
    label: string;
    raw: string;
    min?: number;
    max?: number;
    integer?: boolean;
  }> = [
    { field: "gpsLatitude", label: "Latitude", raw: params.gpsLatitude, min: -90, max: 90 },
    { field: "gpsLongitude", label: "Longitude", raw: params.gpsLongitude, min: -180, max: 180 },
    { field: "iso", label: "ISO", raw: params.iso, min: 1, max: 1_000_000, integer: true },
    { field: "focalLengthMm", label: "Focal length", raw: params.focalLengthMm, min: 0.000001, max: 5000 },
    {
      field: "exposureCompensationEv",
      label: "Exposure compensation",
      raw: params.exposureCompensationEv,
      min: -20,
      max: 20,
    },
    { field: "apertureFNumber", label: "Aperture", raw: params.apertureFNumber, min: 0.000001, max: 64 },
    { field: "imageWidth", label: "Image width", raw: params.imageWidth, min: 1, max: 20000, integer: true },
    { field: "imageHeight", label: "Image height", raw: params.imageHeight, min: 1, max: 20000, integer: true },
    { field: "megapixels", label: "Megapixels", raw: params.megapixels, min: 0.000001, max: 300 },
  ];

  for (const config of numericConfigs) {
    const parsed = parseNumberField(config);
    if (parsed.error) {
      return { overrides: {}, error: parsed.error };
    }
    if (parsed.present && parsed.value !== null) {
      overrides[config.field] = parsed.value;
    }
  }

  const keywords = params.keywordsText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (keywords.length > 0) {
    overrides.keywords = keywords;
  }

  return { overrides, error: null };
}
