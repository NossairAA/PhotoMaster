import { describe, expect, it, vi } from "vitest";
import { geocodeLocation, reverseGeocodeLocation } from "../location";

describe("location utilities", () => {
  it("returns coordinates from geocode result", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "48.8566", lon: "2.3522" }],
    });

    const coords = await geocodeLocation("Paris", mockFetch as unknown as typeof fetch);
    expect(coords).toEqual([48.8566, 2.3522]);
  });

  it("returns full formatted address from reverse geocode", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        display_name: "18 Rue de Phalsbourg, 54000 Nancy, France",
      }),
    });

    const address = await reverseGeocodeLocation([48.68473, 6.168514], mockFetch as unknown as typeof fetch);
    expect(address).toBe("18 Rue de Phalsbourg, 54000 Nancy, France");
  });

  it("returns null when reverse geocode has no display name", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const address = await reverseGeocodeLocation([48.68473, 6.168514], mockFetch as unknown as typeof fetch);
    expect(address).toBeNull();
  });
});
