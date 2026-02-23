import type { MetadataDraftInput } from "./job-overrides";

export type MetadataDraftPatch = Partial<MetadataDraftInput>;

const metadataKeys = [
  "dateTimeOriginal",
  "gpsLatitude",
  "gpsLongitude",
  "locationLabel",
  "cameraMake",
  "cameraModel",
  "lensModel",
  "iso",
  "focalLengthMm",
  "exposureCompensationEv",
  "apertureFNumber",
  "shutterSpeed",
  "imageWidth",
  "imageHeight",
  "megapixels",
  "title",
  "caption",
  "keywordsText",
  "author",
  "copyright",
] as const satisfies Array<keyof MetadataDraftInput>;

export function createEmptyMetadataDraft(): MetadataDraftInput {
  return {
    dateTimeOriginal: "",
    gpsLatitude: "",
    gpsLongitude: "",
    locationLabel: "",
    cameraMake: "",
    cameraModel: "",
    lensModel: "",
    iso: "",
    focalLengthMm: "",
    exposureCompensationEv: "",
    apertureFNumber: "",
    shutterSpeed: "",
    imageWidth: "",
    imageHeight: "",
    megapixels: "",
    title: "",
    caption: "",
    keywordsText: "",
    author: "",
    copyright: "",
  };
}

export function mergeMetadataDrafts(guided: MetadataDraftPatch, advanced: MetadataDraftPatch) {
  const merged = createEmptyMetadataDraft();

  for (const key of metadataKeys) {
    const hasAdvanced = Object.prototype.hasOwnProperty.call(advanced, key);
    if (hasAdvanced) {
      merged[key] = advanced[key] ?? "";
      continue;
    }

    merged[key] = guided[key] ?? "";
  }

  return merged;
}
