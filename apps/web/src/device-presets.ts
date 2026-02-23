type CameraPreset = {
  id: string;
  label: string;
  cameraModel: string;
  lensModel: string;
  focalLengthMm: number;
  apertureFNumber: number;
};

type DevicePreset = {
  id: string;
  label: string;
  cameraMake: string;
  cameras: CameraPreset[];
};

type DeviceBrandPreset = {
  id: string;
  label: string;
  devices: DevicePreset[];
};

type DeviceParams = {
  id: string;
  label: string;
  make: string;
  model: string;
  main: { focal: number; aperture: number };
  ultraWide: { focal: number; aperture: number };
  telephoto?: { focal: number; aperture: number };
};

function makeDualOrTripleCameraDevice(params: DeviceParams): DevicePreset {
  const cameras: CameraPreset[] = [
    {
      id: "main",
      label: "Main camera",
      cameraModel: params.model,
      lensModel: `${params.label} back camera ${params.main.focal}mm f/${params.main.aperture}`,
      focalLengthMm: params.main.focal,
      apertureFNumber: params.main.aperture,
    },
    {
      id: "ultra-wide",
      label: "Ultra-wide camera",
      cameraModel: params.model,
      lensModel: `${params.label} ultra-wide camera ${params.ultraWide.focal}mm f/${params.ultraWide.aperture}`,
      focalLengthMm: params.ultraWide.focal,
      apertureFNumber: params.ultraWide.aperture,
    },
  ];

  if (params.telephoto) {
    cameras.push({
      id: "telephoto",
      label: "Telephoto camera",
      cameraModel: params.model,
      lensModel: `${params.label} telephoto camera ${params.telephoto.focal}mm f/${params.telephoto.aperture}`,
      focalLengthMm: params.telephoto.focal,
      apertureFNumber: params.telephoto.aperture,
    });
  }

  return {
    id: params.id,
    label: params.label,
    cameraMake: params.make,
    cameras,
  };
}

const appleDevices: DevicePreset[] = [
  makeDualOrTripleCameraDevice({
    id: "iphone-13-mini",
    label: "iPhone 13 mini",
    make: "Apple",
    model: "iPhone 13 mini",
    main: { focal: 5.1, aperture: 1.6 },
    ultraWide: { focal: 1.5, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-13",
    label: "iPhone 13",
    make: "Apple",
    model: "iPhone 13",
    main: { focal: 5.1, aperture: 1.6 },
    ultraWide: { focal: 1.5, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-13-pro",
    label: "iPhone 13 Pro",
    make: "Apple",
    model: "iPhone 13 Pro",
    main: { focal: 5.7, aperture: 1.5 },
    ultraWide: { focal: 1.5, aperture: 1.8 },
    telephoto: { focal: 9, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-13-pro-max",
    label: "iPhone 13 Pro Max",
    make: "Apple",
    model: "iPhone 13 Pro Max",
    main: { focal: 5.7, aperture: 1.5 },
    ultraWide: { focal: 1.5, aperture: 1.8 },
    telephoto: { focal: 9, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-14",
    label: "iPhone 14",
    make: "Apple",
    model: "iPhone 14",
    main: { focal: 5.7, aperture: 1.5 },
    ultraWide: { focal: 1.6, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-14-plus",
    label: "iPhone 14 Plus",
    make: "Apple",
    model: "iPhone 14 Plus",
    main: { focal: 5.7, aperture: 1.5 },
    ultraWide: { focal: 1.6, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-14-pro",
    label: "iPhone 14 Pro",
    make: "Apple",
    model: "iPhone 14 Pro",
    main: { focal: 6.86, aperture: 1.78 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 9, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-14-pro-max",
    label: "iPhone 14 Pro Max",
    make: "Apple",
    model: "iPhone 14 Pro Max",
    main: { focal: 6.86, aperture: 1.78 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 9, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-15",
    label: "iPhone 15",
    make: "Apple",
    model: "iPhone 15",
    main: { focal: 6.86, aperture: 1.6 },
    ultraWide: { focal: 1.6, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-15-plus",
    label: "iPhone 15 Plus",
    make: "Apple",
    model: "iPhone 15 Plus",
    main: { focal: 6.86, aperture: 1.6 },
    ultraWide: { focal: 1.6, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-15-pro",
    label: "iPhone 15 Pro",
    make: "Apple",
    model: "iPhone 15 Pro",
    main: { focal: 6.86, aperture: 1.78 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 9, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-15-pro-max",
    label: "iPhone 15 Pro Max",
    make: "Apple",
    model: "iPhone 15 Pro Max",
    main: { focal: 6.86, aperture: 1.78 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 12, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-16",
    label: "iPhone 16",
    make: "Apple",
    model: "iPhone 16",
    main: { focal: 6.9, aperture: 1.6 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-16-plus",
    label: "iPhone 16 Plus",
    make: "Apple",
    model: "iPhone 16 Plus",
    main: { focal: 6.9, aperture: 1.6 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-16-pro",
    label: "iPhone 16 Pro",
    make: "Apple",
    model: "iPhone 16 Pro",
    main: { focal: 6.9, aperture: 1.78 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 10.5, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "iphone-16-pro-max",
    label: "iPhone 16 Pro Max",
    make: "Apple",
    model: "iPhone 16 Pro Max",
    main: { focal: 6.9, aperture: 1.78 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 12, aperture: 2.8 },
  }),
];

const samsungDevices: DevicePreset[] = [
  makeDualOrTripleCameraDevice({
    id: "galaxy-s23",
    label: "Galaxy S23",
    make: "Samsung",
    model: "SM-S911B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 7, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s23-plus",
    label: "Galaxy S23+",
    make: "Samsung",
    model: "SM-S916B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 7, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s23-ultra",
    label: "Galaxy S23 Ultra",
    make: "Samsung",
    model: "SM-S918B",
    main: { focal: 6.3, aperture: 1.7 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 9, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s24",
    label: "Galaxy S24",
    make: "Samsung",
    model: "SM-S921B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 7, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s24-plus",
    label: "Galaxy S24+",
    make: "Samsung",
    model: "SM-S926B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 7, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s24-ultra",
    label: "Galaxy S24 Ultra",
    make: "Samsung",
    model: "SM-S928B",
    main: { focal: 6.3, aperture: 1.7 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 9, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s25",
    label: "Galaxy S25",
    make: "Samsung",
    model: "SM-S931B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 7, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s25-plus",
    label: "Galaxy S25+",
    make: "Samsung",
    model: "SM-S936B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 7, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-s25-ultra",
    label: "Galaxy S25 Ultra",
    make: "Samsung",
    model: "SM-S938B",
    main: { focal: 6.3, aperture: 1.7 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 9.5, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-z-fold5",
    label: "Galaxy Z Fold5",
    make: "Samsung",
    model: "SM-F946B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 9.0, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-z-fold6",
    label: "Galaxy Z Fold6",
    make: "Samsung",
    model: "SM-F956B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
    telephoto: { focal: 9.0, aperture: 2.4 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-z-flip5",
    label: "Galaxy Z Flip5",
    make: "Samsung",
    model: "SM-F731B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-z-flip6",
    label: "Galaxy Z Flip6",
    make: "Samsung",
    model: "SM-F741B",
    main: { focal: 5.4, aperture: 1.8 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-a55",
    label: "Galaxy A55",
    make: "Samsung",
    model: "SM-A556B",
    main: { focal: 5.2, aperture: 1.8 },
    ultraWide: { focal: 1.8, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "galaxy-a56",
    label: "Galaxy A56",
    make: "Samsung",
    model: "SM-A566B",
    main: { focal: 5.2, aperture: 1.8 },
    ultraWide: { focal: 1.8, aperture: 2.2 },
  }),
];

const pixelDevices: DevicePreset[] = [
  makeDualOrTripleCameraDevice({
    id: "pixel-7",
    label: "Pixel 7",
    make: "Google",
    model: "Pixel 7",
    main: { focal: 6.8, aperture: 1.85 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-7-pro",
    label: "Pixel 7 Pro",
    make: "Google",
    model: "Pixel 7 Pro",
    main: { focal: 6.8, aperture: 1.85 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
    telephoto: { focal: 18.5, aperture: 3.5 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-7a",
    label: "Pixel 7a",
    make: "Google",
    model: "Pixel 7a",
    main: { focal: 5.4, aperture: 1.89 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-8",
    label: "Pixel 8",
    make: "Google",
    model: "Pixel 8",
    main: { focal: 6.9, aperture: 1.68 },
    ultraWide: { focal: 2.2, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-8-pro",
    label: "Pixel 8 Pro",
    make: "Google",
    model: "Pixel 8 Pro",
    main: { focal: 6.9, aperture: 1.68 },
    ultraWide: { focal: 2.2, aperture: 2.0 },
    telephoto: { focal: 18.7, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-8a",
    label: "Pixel 8a",
    make: "Google",
    model: "Pixel 8a",
    main: { focal: 5.4, aperture: 1.89 },
    ultraWide: { focal: 1.7, aperture: 2.2 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-9",
    label: "Pixel 9",
    make: "Google",
    model: "Pixel 9",
    main: { focal: 6.9, aperture: 1.68 },
    ultraWide: { focal: 2.2, aperture: 2.0 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-9-pro",
    label: "Pixel 9 Pro",
    make: "Google",
    model: "Pixel 9 Pro",
    main: { focal: 6.9, aperture: 1.68 },
    ultraWide: { focal: 2.2, aperture: 2.0 },
    telephoto: { focal: 18.0, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-9-pro-xl",
    label: "Pixel 9 Pro XL",
    make: "Google",
    model: "Pixel 9 Pro XL",
    main: { focal: 6.9, aperture: 1.68 },
    ultraWide: { focal: 2.2, aperture: 2.0 },
    telephoto: { focal: 18.0, aperture: 2.8 },
  }),
  makeDualOrTripleCameraDevice({
    id: "pixel-9-pro-fold",
    label: "Pixel 9 Pro Fold",
    make: "Google",
    model: "Pixel 9 Pro Fold",
    main: { focal: 6.9, aperture: 1.7 },
    ultraWide: { focal: 2.1, aperture: 2.2 },
    telephoto: { focal: 10.8, aperture: 2.8 },
  }),
];

export const devicePresets: DeviceBrandPreset[] = [
  {
    id: "apple",
    label: "Apple",
    devices: appleDevices,
  },
  {
    id: "samsung",
    label: "Samsung",
    devices: samsungDevices,
  },
  {
    id: "pixel",
    label: "Pixel",
    devices: pixelDevices,
  },
];

export function buildDevicePrefill(cameraMake: string, camera?: CameraPreset | null) {
  if (!camera) {
    return {
      cameraMake,
      cameraModel: "",
      lensModel: "",
      focalLengthMm: "",
      apertureFNumber: "",
    };
  }

  return {
    cameraMake,
    cameraModel: camera.cameraModel,
    lensModel: camera.lensModel,
    focalLengthMm: String(camera.focalLengthMm),
    apertureFNumber: String(camera.apertureFNumber),
  };
}

export type { CameraPreset, DevicePreset, DeviceBrandPreset };
