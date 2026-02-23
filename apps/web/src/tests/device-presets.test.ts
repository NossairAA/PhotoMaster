import { describe, expect, it } from "vitest";
import { buildDevicePrefill, devicePresets } from "../device-presets";

describe("device presets", () => {
  it("contains required brands", () => {
    const brands = devicePresets.map((brand) => brand.id);
    expect(brands).toEqual(expect.arrayContaining(["apple", "samsung", "pixel"]));
  });

  it("maps selected camera preset to metadata fields", () => {
    const camera = devicePresets[0].devices[0].cameras[0];
    const prefill = buildDevicePrefill("Apple", camera);

    expect(prefill).toEqual({
      cameraMake: "Apple",
      cameraModel: camera.cameraModel,
      lensModel: camera.lensModel,
      focalLengthMm: String(camera.focalLengthMm),
      apertureFNumber: String(camera.apertureFNumber),
    });
  });

  it("includes recent flagship models across brands", () => {
    const allDeviceIds = devicePresets.flatMap((brand) => brand.devices.map((device) => device.id));
    expect(allDeviceIds).toEqual(
      expect.arrayContaining([
        "iphone-16",
        "iphone-16-plus",
        "iphone-16-pro",
        "iphone-16-pro-max",
        "galaxy-s25",
        "galaxy-s25-plus",
        "galaxy-s25-ultra",
        "pixel-9",
        "pixel-9-pro",
        "pixel-9-pro-xl",
      ]),
    );
  });
});
