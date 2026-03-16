import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Circle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Database,
  FileEdit,
  Loader2,
  MapPin,
  MapPinned,
  Play,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { uploadFileWithFallback, withAuthHeaders } from "./api-client";
import { getHeaderAuthActionLabel, shouldShowTreatmentWorkspace, shouldShowWelcomeHero } from "./auth-ui";
import {
  deleteCurrentUserAccount,
  getSignInMethodsForEmailAddress,
  getUserProfile,
  getCurrentUserIdToken,
  observeAuthState,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
  signUpWithGoogleProfile,
  signUpWithEmailProfile,
  syncUsernameIndexForUser,
} from "./firebase";
import { normalizeUsername, validateUsername } from "./auth-profile";
import { getPasswordRuleStatuses, isStrongPassword } from "./password-rules";
import { mapAuthErrorMessage } from "./auth-errors";
import { canCreateJob, type UploadStatus } from "./upload-state";
import { geocodeLocation, reverseGeocodeLocation } from "./location";
import { buildDateOverride, formatDateTimeLocalToExif, formatExifToDateTimeLocal, type DateMode } from "./date-overrides";
import { buildDevicePrefill, devicePresets } from "./device-presets";
import { buildJobOverrides } from "./job-overrides";
import { createEmptyMetadataDraft, mergeMetadataDrafts } from "./metadata-draft";

type Feature = {
  icon: ReactElement<{ className?: string }>;
  title: string;
  description: string;
};

type UploadInitFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  format: string;
  uploadUrl: string;
  method: "PUT";
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const DEFAULT_BEARER_TOKEN = import.meta.env.DEV ? (import.meta.env.VITE_AUTH_BEARER_TOKEN ?? "") : "";

function getSupportedFormat(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "heic" || ext === "heif") {
    return ext;
  }
  return null;
}

async function getApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // ignore invalid json body
  }
  return `Request failed (${response.status})`;
}

type MapPickerProps = {
  center: [number, number];
  pinnedPoint: [number, number] | null;
  onPin: (point: [number, number]) => void;
};

function MapPicker({ center, pinnedPoint, onPin }: MapPickerProps) {
  function ClickHandler() {
    useMapEvents({
      click(event) {
        onPin([event.latlng.lat, event.latlng.lng]);
      },
    });

    return null;
  }

  const markerCenter = pinnedPoint ?? center;

  return (
    <MapContainer center={center} zoom={13} className="h-[320px] w-full rounded-2xl" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler />
      <CircleMarker center={markerCenter} radius={8} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.7 }} />
    </MapContainer>
  );
}

function App() {
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);
  const accountMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const authModalPanelRef = useRef<HTMLDivElement | null>(null);
  const advancedModalPanelRef = useRef<HTMLDivElement | null>(null);
  const mapModalPanelRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "account">("signin");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [usernameAvailability, setUsernameAvailability] = useState<"idle" | "taken">("idle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authToken, setAuthToken] = useState(DEFAULT_BEARER_TOKEN);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Choose files and prepare metadata fields.");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [jobCompletedAt, setJobCompletedAt] = useState<number | null>(null);
  const [downloadSecondsLeft, setDownloadSecondsLeft] = useState<number | null>(null);

  const [dateMode, setDateMode] = useState<DateMode>("keep-original");
  const [customDateTime, setCustomDateTime] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState(devicePresets[0]?.id ?? "");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [guidedGpsLatitude, setGuidedGpsLatitude] = useState("");
  const [guidedGpsLongitude, setGuidedGpsLongitude] = useState("");
  const [guidedLocationLabel, setGuidedLocationLabel] = useState("");
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<Partial<ReturnType<typeof createEmptyMetadataDraft>>>({});
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([35.6762, 139.6503]);
  const [mapPinnedPoint, setMapPinnedPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (jobCompletedAt === null) return;
    const RETENTION_MS = 2 * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((jobCompletedAt + RETENTION_MS - Date.now()) / 1000));
      setDownloadSecondsLeft(left);
      if (left === 0) setDownloadSecondsLeft(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [jobCompletedAt]);

  useEffect(() => {
    const unsubscribe = observeAuthState((user) => {
      setIsAuthenticated(Boolean(user));
      setUserEmail(user?.email ?? "");

      if (!user) {
        setProfileName("");
        setProfileUsername("");
        setAccountMenuOpen(false);
        setAuthMode("signin");
        setAuthToken(DEFAULT_BEARER_TOKEN);
        return;
      }

      setAuthMode("account");
      setProfileName(user.displayName ?? "");
      setProfileUsername(normalizeUsername(user.email?.split("@")[0] ?? ""));
      void getUserProfile(user.uid)
        .then((profile) => {
          if (!profile) return;
          if (profile.name) setProfileName(profile.name);
          if (profile.username) setProfileUsername(profile.username);
          if (profile.username && user.email) {
            void syncUsernameIndexForUser({
              uid: user.uid,
              username: profile.username,
            }).catch(() => {
              // background sync only
            });
          }
        })
        .catch(() => {
          // profile lookup is optional for authenticated workflow
        });

      void user
        .getIdToken()
        .then((token) => setAuthToken(token))
        .catch(() => setAuthToken(""));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!jobId) return;

      void fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: withAuthHeaders(authToken),
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [authToken, jobId]);

  useEffect(() => {
    if (selectedDeviceId) return;
    const brand = devicePresets.find((item) => item.id === selectedBrandId);
    const firstDevice = brand?.devices[0];
    if (!firstDevice) return;
    setSelectedDeviceId(firstDevice.id);
    setSelectedCameraId(firstDevice.cameras[0]?.id ?? "");
  }, [selectedBrandId, selectedDeviceId]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (accountMenuContainerRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
      setShowDeleteSection(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!authModalOpen && !advancedModalOpen && !mapModalOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (advancedModalOpen) {
        setAdvancedModalOpen(false);
        return;
      }
      if (mapModalOpen) {
        setMapModalOpen(false);
        return;
      }
      if (authModalOpen) {
        closeAuthModal();
      }
    };

    const panel = authModalOpen ? authModalPanelRef.current : advancedModalOpen ? advancedModalPanelRef.current : mapModalOpen ? mapModalPanelRef.current : null;
    const firstFocusable = panel?.querySelector<HTMLElement>("input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])");
    firstFocusable?.focus();

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [advancedModalOpen, authModalOpen, mapModalOpen]);

  const canRunJob = canCreateJob({
    selectedFileCount: selectedFiles.length,
    uploadedFileCount: uploadedFileIds.length,
    uploadStatus,
    isSubmitting,
  });

  const selectedCountLabel = useMemo(() => {
    if (selectedFiles.length === 0) return "No files selected";
    if (selectedFiles.length === 1) return "1 file selected";
    return `${selectedFiles.length} files selected`;
  }, [selectedFiles.length]);

  const previewUrl = useMemo(() => {
    const first = selectedFiles[0];
    if (!first) return "";
    return URL.createObjectURL(first);
  }, [selectedFiles]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectedBrand = useMemo(() => devicePresets.find((brand) => brand.id === selectedBrandId) ?? null, [selectedBrandId]);
  const selectedDevice = useMemo(
    () => selectedBrand?.devices.find((device) => device.id === selectedDeviceId) ?? null,
    [selectedBrand, selectedDeviceId],
  );
  const selectedCamera = useMemo(
    () => selectedDevice?.cameras.find((camera) => camera.id === selectedCameraId) ?? null,
    [selectedDevice, selectedCameraId],
  );

  const guidedDeviceDraft = useMemo(
    () => buildDevicePrefill(selectedDevice?.cameraMake ?? "", selectedCamera),
    [selectedDevice, selectedCamera],
  );

  const mergedMetadataDraft = useMemo(() => {
    const date = buildDateOverride(dateMode, customDateTime);
    return mergeMetadataDrafts(
      {
        dateTimeOriginal: date.value,
        gpsLatitude: guidedGpsLatitude,
        gpsLongitude: guidedGpsLongitude,
        locationLabel: guidedLocationLabel,
        cameraMake: guidedDeviceDraft.cameraMake,
        cameraModel: guidedDeviceDraft.cameraModel,
        lensModel: guidedDeviceDraft.lensModel,
        focalLengthMm: guidedDeviceDraft.focalLengthMm,
        apertureFNumber: guidedDeviceDraft.apertureFNumber,
      },
      advancedDraft,
    );
  }, [advancedDraft, customDateTime, dateMode, guidedDeviceDraft, guidedGpsLatitude, guidedGpsLongitude, guidedLocationLabel]);

  const normalizedSignUpUsername = useMemo(() => normalizeUsername(signUpUsername), [signUpUsername]);
  const signUpUsernameValidation = useMemo(() => validateUsername(normalizedSignUpUsername), [normalizedSignUpUsername]);
  const passwordRuleStatuses = useMemo(() => getPasswordRuleStatuses(signUpPassword), [signUpPassword]);
  const passwordStrong = useMemo(() => isStrongPassword(signUpPassword), [signUpPassword]);
  const passwordsMatch = useMemo(
    () => signUpPassword.length > 0 && signUpPassword === signUpConfirmPassword,
    [signUpConfirmPassword, signUpPassword],
  );
  const canSubmitSignUp =
    Boolean(signUpName.trim()) &&
    Boolean(signUpEmail.trim()) &&
    passwordStrong &&
    passwordsMatch &&
    signUpUsernameValidation.valid &&
    usernameAvailability !== "taken" &&
    !authPending;

  const headerAuthLabel = getHeaderAuthActionLabel(isAuthenticated, {
    signIn: "Sign In",
    account: "Account",
  });
  const accountNameLabel = profileName || userEmail.split("@")[0] || "Not set";
  const accountUsernameLabel = profileUsername || normalizeUsername(userEmail.split("@")[0] ?? "");
  const showWelcomeHero = shouldShowWelcomeHero(isAuthenticated);
  const showTreatmentWorkspace = shouldShowTreatmentWorkspace(isAuthenticated);

  function resetAuthFormState() {
    setSignInEmail("");
    setSignInPassword("");
    setSignUpName("");
    setSignUpUsername("");
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpConfirmPassword("");
    setAuthError("");
    setUsernameAvailability("idle");
  }

  function openAuthModal(mode?: "signin" | "signup" | "account") {
    resetAuthFormState();
    setAccountMenuOpen(false);
    setShowDeleteSection(false);
    setDeleteConfirmText("");
    setDeletePassword("");
    setAuthModalOpen(true);
    if (mode) {
      setAuthMode(mode);
      return;
    }
    setAuthMode("signin");
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
    resetAuthFormState();
    setShowDeleteSection(false);
  }

  function handleHeaderAuthAction() {
    if (!isAuthenticated) {
      openAuthModal("signin");
      return;
    }

    setAccountMenuOpen((previous) => !previous);
    setShowDeleteSection(false);
    setAuthError("");
  }

  async function resolveApiToken() {
    const liveToken = await getCurrentUserIdToken(true);
    if (liveToken) {
      setAuthToken(liveToken);
      return liveToken;
    }

    return authToken.trim() || null;
  }

  async function handleSignIn() {
    if (!signInEmail.trim() || !signInPassword) {
      setAuthError("Enter your email and password.");
      return;
    }

    setAuthPending(true);
    setAuthError("");

    try {
      await signInWithEmail(signInEmail.trim(), signInPassword);
      closeAuthModal();
      setStatusMessage("Authentication successful.");
    } catch (error) {
      setAuthError(mapAuthErrorMessage(error, "We could not sign you in. Please check your login details and try again."));
    } finally {
      setAuthPending(false);
    }
  }

  async function handleSignUp() {
    const trimmedName = signUpName.trim();
    const trimmedUsername = normalizedSignUpUsername;
    const validation = signUpUsernameValidation;

    if (!trimmedName) {
      setAuthError("Name is required.");
      return;
    }

    if (!validation.valid) {
      setAuthError(validation.error);
      return;
    }

    if (!signUpEmail.trim() || !signUpPassword) {
      setAuthError("Email and password are required.");
      return;
    }

    if (!passwordStrong) {
      setAuthError("Password does not meet the required rules.");
      return;
    }

    if (!passwordsMatch) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthPending(true);
    setAuthError("");

    try {
      await signUpWithEmailProfile({
        name: trimmedName,
        username: trimmedUsername,
        email: signUpEmail.trim(),
        password: signUpPassword,
      });
      setProfileName(trimmedName);
      setProfileUsername(trimmedUsername);
      closeAuthModal();
      setStatusMessage("Profile created and signed in.");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const message = mapAuthErrorMessage(error, "We could not create your profile right now. Please try again.");
      if (/(already taken|username-reserved)/i.test(rawMessage) || /(already taken|unavailable)/i.test(message)) {
        setUsernameAvailability("taken");
      }
      setAuthError(message);
    } finally {
      setAuthPending(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthPending(true);
    setAuthError("");

    try {
      await signInWithGoogle();
      closeAuthModal();
      setStatusMessage("Authentication successful.");
    } catch (error) {
      setAuthError(mapAuthErrorMessage(error, "Google sign-in could not be completed. Please try again."));
    } finally {
      setAuthPending(false);
    }
  }

  async function handleGoogleSignUp() {
    const trimmedUsername = normalizedSignUpUsername;
    const validation = signUpUsernameValidation;
    const trimmedEmail = signUpEmail.trim();

    if (!validation.valid) {
      setAuthError(validation.error);
      return;
    }

    if (!trimmedEmail || !/.+@.+\..+/.test(trimmedEmail)) {
      setAuthError("Enter a valid email before continuing with Google sign-up.");
      return;
    }

    setAuthPending(true);
    setAuthError("");

    try {
      const existingMethods = await getSignInMethodsForEmailAddress(trimmedEmail);
      if (existingMethods.length > 0) {
        setAuthError("An account already exists with this email. Please sign in instead.");
        return;
      }

      await signUpWithGoogleProfile({
        name: signUpName.trim(),
        username: trimmedUsername,
        expectedEmail: trimmedEmail,
      });
      setProfileUsername(trimmedUsername);
      closeAuthModal();
      setStatusMessage("Profile created and signed in.");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const message = mapAuthErrorMessage(error, "We could not create your profile with Google. Please try again.");
      if (/(already taken|username-reserved)/i.test(rawMessage) || /(already taken|unavailable)/i.test(message)) {
        setUsernameAvailability("taken");
      }
      setAuthError(message);
    } finally {
      setAuthPending(false);
    }
  }

  async function handleSignOut() {
    try {
      setAccountMenuOpen(false);
      closeAuthModal();
      await signOutCurrentUser();
      setAuthMode("signin");
      setStatusMessage("Signed out.");
    } catch (error) {
      setAuthError(mapAuthErrorMessage(error, "We could not sign you out. Please try again."));
    }
  }

  async function handleDeleteProfile() {
    if (deleteConfirmText.trim() !== "DELETE") {
      setAuthError("Type DELETE to confirm account deletion.");
      return;
    }

    setAuthPending(true);
    setAuthError("");

    try {
      setAccountMenuOpen(false);
      await deleteCurrentUserAccount(deletePassword.trim() || undefined);
      closeAuthModal();
      setShowDeleteSection(false);
      setDeleteConfirmText("");
      setDeletePassword("");
      setAuthMode("signin");
      setStatusMessage("Profile deleted.");
    } catch (error) {
      setAuthError(mapAuthErrorMessage(error, "We could not delete your profile right now. Please try again."));
    } finally {
      setAuthPending(false);
    }
  }

  function handleBrandChange(brandId: string) {
    setSelectedBrandId(brandId);
    const brand = devicePresets.find((item) => item.id === brandId);
    const firstDevice = brand?.devices[0];
    setSelectedDeviceId(firstDevice?.id ?? "");
    setSelectedCameraId(firstDevice?.cameras[0]?.id ?? "");
  }

  function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId);
    const device = selectedBrand?.devices.find((item) => item.id === deviceId);
    setSelectedCameraId(device?.cameras[0]?.id ?? "");
  }

  async function uploadFiles(files: File[] = selectedFiles) {
    const token = await resolveApiToken();
    if (!token) {
      setStatusMessage("Sign in first to upload files.");
      openAuthModal("signin");
      return;
    }

    if (files.length === 0) {
      setStatusMessage("Pick at least one image file first.");
      return;
    }

    const normalized = files.map((file) => ({
      file,
      format: getSupportedFormat(file.name),
    }));
    const unsupported = normalized.find((item) => !item.format);

    if (unsupported) {
      setStatusMessage(`Unsupported file format: ${unsupported.file.name}`);
      setUploadStatus("failed");
      return;
    }

    setUploadStatus("uploading");
    setJobProgress(0);
    setJobId(null);
    setUploadedFileIds([]);

    try {
      const initRes = await fetch(`${API_URL}/api/uploads/init`, {
        method: "POST",
        headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          files: normalized.map(({ file, format }) => ({
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            format,
          })),
        }),
      });

      if (!initRes.ok) {
        throw new Error(await getApiError(initRes));
      }

      const initBody = (await initRes.json()) as { files: UploadInitFile[] };
      if (initBody.files.length !== normalized.length) {
        throw new Error("Upload session mismatch. Please retry file upload.");
      }

      for (let i = 0; i < initBody.files.length; i += 1) {
        const prepared = initBody.files[i];
        const source = normalized[i].file;
        await uploadFileWithFallback({
          apiUrl: API_URL,
          authToken: token,
          fileId: prepared.id,
          uploadUrl: prepared.uploadUrl,
          file: source,
        });
      }

      const fileIds = initBody.files.map((file) => file.id);
      const completeRes = await fetch(`${API_URL}/api/uploads/complete`, {
        method: "POST",
        headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ fileIds }),
      });

      if (!completeRes.ok) {
        throw new Error(await getApiError(completeRes));
      }

      setUploadedFileIds(fileIds);
      setUploadStatus("uploaded");
      setStatusMessage("Files uploaded. You can now run metadata processing.");
    } catch (error) {
      setUploadStatus("failed");
      setStatusMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  function handleUploadButtonClick() {
    if (selectedFiles.length === 0) {
      hiddenFileInputRef.current?.click();
      return;
    }

    void uploadFiles();
  }

  function handleFileSelection(files: File[]) {
    setSelectedFiles(files);
    setUploadedFileIds([]);
    setUploadStatus("idle");
    setJobId(null);
    setJobProgress(0);
    setMapPinnedPoint(null);

    if (files.length === 0) {
      setStatusMessage("Choose files and prepare metadata fields.");
      return;
    }

    void uploadFiles(files);
  }

  async function fillCoordinates() {
    if (!locationQuery.trim()) return;
    setIsGeocoding(true);
    try {
      const coords = await geocodeLocation(locationQuery.trim());
      if (!coords) {
        setStatusMessage("No coordinates found for that location query.");
        return;
      }

      setGuidedGpsLatitude(coords[0].toFixed(6));
      setGuidedGpsLongitude(coords[1].toFixed(6));
      setMapCenter(coords);
      setMapPinnedPoint(coords);
      const label = await reverseGeocodeLocation(coords);
      if (label) {
        setGuidedLocationLabel(label);
      }
      setStatusMessage("Location fields filled from geocoding.");
    } catch {
      setStatusMessage("Location lookup failed. Try another query.");
    } finally {
      setIsGeocoding(false);
    }
  }

  async function openMapPicker() {
    if (locationQuery.trim()) {
      setIsGeocoding(true);
      try {
        const coords = await geocodeLocation(locationQuery.trim());
        if (coords) {
          setMapCenter(coords);
          setMapPinnedPoint(coords);
        }
      } catch {
        setStatusMessage("Could not center map from search. You can still pin manually.");
      } finally {
        setIsGeocoding(false);
      }
    }

    setMapModalOpen(true);
  }

  async function applyPinnedLocation() {
    const point = mapPinnedPoint ?? mapCenter;
    setGuidedGpsLatitude(point[0].toFixed(6));
    setGuidedGpsLongitude(point[1].toFixed(6));

    try {
      const label = await reverseGeocodeLocation(point);
      if (label) {
        setGuidedLocationLabel(label);
      }
      setStatusMessage("Location pinned from map.");
    } catch {
      setStatusMessage("Location pinned, but reverse geocode failed.");
    }

    setMapModalOpen(false);
  }

  function updateAdvancedField(field: keyof ReturnType<typeof createEmptyMetadataDraft>, value: string) {
    setAdvancedDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function runJob() {
    if (!canRunJob) return;
    const token = await resolveApiToken();
    if (!token) {
      setStatusMessage("Sign in first to start processing.");
      openAuthModal("signin");
      return;
    }

    const dateOverride = buildDateOverride(dateMode, customDateTime);
    if (dateOverride.error) {
      setStatusMessage(dateOverride.error);
      return;
    }

    const merged = mergeMetadataDrafts(
      {
        dateTimeOriginal: dateOverride.value,
        gpsLatitude: guidedGpsLatitude,
        gpsLongitude: guidedGpsLongitude,
        locationLabel: guidedLocationLabel,
        cameraMake: guidedDeviceDraft.cameraMake,
        cameraModel: guidedDeviceDraft.cameraModel,
        lensModel: guidedDeviceDraft.lensModel,
        focalLengthMm: guidedDeviceDraft.focalLengthMm,
        apertureFNumber: guidedDeviceDraft.apertureFNumber,
      },
      advancedDraft,
    );

    const { overrides, error } = buildJobOverrides(merged);

    if (error) {
      setStatusMessage(error);
      return;
    }

    if (Object.keys(overrides).length === 0) {
      setStatusMessage("Add at least one metadata override before running.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Job queued. Processing started...");
    setJobProgress(0);

    try {
      const createRes = await fetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          fileIds: uploadedFileIds,
          overrides,
        }),
      });

      if (!createRes.ok) {
        throw new Error(await getApiError(createRes));
      }

      const createBody = (await createRes.json()) as { id: string; message: string };
      setJobId(createBody.id);

      let complete = false;
      while (!complete) {
        await new Promise((resolve) => setTimeout(resolve, 1600));
        const statusRes = await fetch(`${API_URL}/api/jobs/${createBody.id}`, {
          headers: withAuthHeaders(token),
        });

        if (!statusRes.ok) {
          throw new Error(await getApiError(statusRes));
        }

        const statusBody = (await statusRes.json()) as {
          status: "queued" | "processing" | "completed";
          progress: number;
          message: string;
        };

        setJobProgress(statusBody.progress);
        setStatusMessage(statusBody.message);
        complete = statusBody.status === "completed";
      }

      setStatusMessage("Processing complete. Download the ZIP result below.");
      setJobCompletedAt(Date.now());
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Job failed.";
      if (msg.toLowerCase().includes("expired")) {
        setErrorPopup(msg);
      } else {
        setStatusMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function downloadResult() {
    if (!jobId) return;
    const token = await resolveApiToken();
    if (!token) {
      setStatusMessage("Sign in first to download results.");
      openAuthModal("signin");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/download`, {
        headers: withAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `photomaster-${jobId}.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusMessage("Download complete. Job artifacts are now cleaned on server.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Download failed.");
    }
  }

  const features: Feature[] = [
    {
      icon: <Calendar className="h-6 w-6 text-blue-600" />,
      title: "Chronological Integrity",
      description:
        "Correct timestamps on scanned physical photos or fix timezone shifts from international travel.",
    },
    {
      icon: <MapPin className="h-6 w-6 text-blue-600" />,
      title: "Geotagging Precision",
      description:
        "Manually inject or override GPS coordinates to place your memories exactly where they happened.",
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-blue-600" />,
      title: "Privacy Sanitization",
      description:
        "Strip sensitive EXIF, IPTC, and XMP data before sharing photos to protect your digital footprint.",
    },
    {
      icon: <FileEdit className="h-6 w-6 text-blue-600" />,
      title: "Custom Field Creation",
      description:
        "Add copyright info, artist credits, and custom descriptions to ensure your work is always attributed.",
    },
  ];

  return (
    <div className="bg-frosted-aurora min-h-screen font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200/90 bg-white/85 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-600 p-2 shadow-sm">
            <Database className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Photo<span className="text-blue-600">Master</span>
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
          <a href="#" className="transition-colors hover:text-blue-600">
            Documentation
          </a>
          <a href="#" className="transition-colors hover:text-blue-600">
            Privacy Guide
          </a>
          <a href="#" className="transition-colors hover:text-blue-600">
            Bulk Tools
          </a>
        </div>
        <div ref={accountMenuContainerRef} className="relative">
          <button
            type="button"
            onClick={handleHeaderAuthAction}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
          >
            {headerAuthLabel}
          </button>

          {isAuthenticated && accountMenuOpen ? (
            <div className="absolute right-0 mt-2 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Name:</span> {accountNameLabel}
                </p>
                <p>
                  <span className="font-semibold">Username:</span> {accountUsernameLabel ? `@${accountUsernameLabel}` : "Not set"}
                </p>
                <p>
                  <span className="font-semibold">Email:</span> {userEmail || "Not set"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Sign out
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteSection((previous) => !previous)}
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
              >
                {showDeleteSection ? "Hide delete profile" : "Delete profile"}
              </button>

                {showDeleteSection ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                    <p className="text-xs text-rose-700">Type DELETE to confirm permanent account removal.</p>
                    <label htmlFor="delete-confirm" className="mb-1.5 block text-xs font-semibold text-rose-700">
                      Type DELETE to confirm
                    </label>
                    <input
                      id="delete-confirm"
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      placeholder="Type DELETE"
                      className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm"
                    />
                    <label htmlFor="delete-password" className="mb-1.5 block text-xs font-semibold text-rose-700">
                      Account password
                    </label>
                    <input
                      id="delete-password"
                      type="password"
                      value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder="Password (required for email/password accounts)"
                    className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDeleteProfile()}
                    disabled={authPending}
                    className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    Delete account permanently
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>

      {showWelcomeHero ? (
        <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center md:pt-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-0 -z-10 mx-auto h-[320px] max-w-5xl rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(37,99,235,0.14),transparent_72%)] blur-2xl md:h-[380px]"
          />
          <div className="flex flex-col items-center space-y-7 md:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-700 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              EXIF & Metadata Studio
            </div>

            <h1 className="max-w-4xl text-4xl font-bold leading-[1.06] tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
              Preserve the Story. <br />
              <span className="text-blue-600">Perfect the Data.</span>
            </h1>

            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-slate-600 md:text-xl">
              Take absolute control of your digital assets. Override, create, and refine the hidden information inside
              your photos for professional archiving and privacy.
            </p>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:bg-blue-700 md:px-10"
              >
                <Upload className="h-5 w-5" />
                Get Started
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 pt-4">
              <div className="hidden -space-x-2 sm:flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-100 bg-white shadow-sm"
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`}
                      alt="user"
                      className="h-full w-full rounded-full"
                    />
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Trusted by 12,000+ photographers & archivists
              </p>
            </div>
          </div>

          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="absolute inset-0 rounded-full bg-blue-400/10 blur-[100px]" />
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                </div>
                <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Editor Console v2.4</span>
                <div className="w-8" />
              </div>

              <div className="grid items-stretch gap-6 p-8 text-left md:h-[560px] md:grid-cols-2 md:p-10">
                <div className="flex h-full flex-col">
                  <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-700">Preview</p>
                      <span className="text-xs text-slate-500">No files selected</span>
                    </div>
                    <div className="flex min-h-[250px] flex-1 items-center justify-center bg-slate-100 text-sm text-slate-500">Select an image to preview.</div>
                  </div>

                  <div className="mt-auto space-y-3 pt-3">
                    <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
                      No files selected
                    </div>
                    <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                      <Upload className="h-4 w-4" />
                      Upload Files
                    </button>
                  </div>
                </div>

                <div className="flex h-full flex-col">
                  <div className="space-y-3.5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">Keep original</div>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                        <CalendarClock className="h-4 w-4" />
                      </div>
                    </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Device</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">Apple</div>
                      <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">iPhone 16</div>
                      <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">Main camera</div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Prefill: Apple iPhone 16</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <div className="truncate rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400">
                        Search location
                      </div>
                      <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                        <MapPin className="h-4 w-4" />
                        Search
                      </button>
                      <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                        <MapPinned className="h-4 w-4" />
                        Pinpoint
                      </button>
                    </div>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400">Latitude</div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400">Longitude</div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400">Location label</div>
                    </div>
                    </div>
                  </div>

                  <div className="mt-auto space-y-3 pt-3">
                    <button className="inline-flex h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Circle className="h-4 w-4" />
                        Advanced metadata
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">
                      <Play className="h-4 w-4" />
                      Apply Metadata
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 -top-4 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:flex">
              <div className="rounded-xl bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Metadata Verified</div>
                <div className="text-[10px] text-slate-500">100% EXIF Standards Compliant</div>
              </div>
            </div>
          </div>
        </main>
      ) : null}

      {showTreatmentWorkspace ? (
        <section id="editor" className="border-y border-slate-200 bg-white py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 text-left">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Treatment Workspace</h2>
              <p className="mt-3 text-slate-600">Upload photos, apply metadata overrides, and download your processed ZIP.</p>
            </div>

            <div className="grid items-stretch gap-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-6 md:p-8 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="flex h-full flex-col text-left">
                <input
                  ref={hiddenFileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.heic,.heif"
                  onChange={(event) => handleFileSelection(Array.from(event.target.files ?? []))}
                  className="hidden"
                />

                <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-700">Preview</p>
                    <span className="text-xs text-slate-500">{selectedCountLabel}</span>
                  </div>
                  <div className="min-h-[360px] flex-1 bg-slate-100 lg:min-h-[420px]">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Selected upload preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Select an image to preview.
                      </div>
                    )}
                  </div>
                  {selectedFiles[0] ? (
                    <div className="grid gap-2 px-4 py-3 text-xs text-slate-600 sm:grid-cols-2">
                      <span>Name: {selectedFiles[0].name}</span>
                      <span>Size: {(selectedFiles[0].size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>Type: {selectedFiles[0].type || "unknown"}</span>
                      <span>Format: {getSupportedFormat(selectedFiles[0].name) ?? "unsupported"}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto space-y-4 pt-4">
                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
                    {selectedCountLabel}
                  </div>

                  <button
                    type="button"
                    onClick={handleUploadButtonClick}
                    disabled={uploadStatus === "uploading" || !authToken}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-semibold text-white disabled:opacity-70"
                  >
                    {uploadStatus === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadStatus === "uploading" ? "Uploading..." : "Upload Files"}
                  </button>
                </div>
              </div>

              <div className="flex h-full flex-col text-left">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label htmlFor="date-mode" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Date mode
                        </label>
                        <select
                          id="date-mode"
                          value={dateMode}
                          onChange={(event) => setDateMode(event.target.value as DateMode)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <option value="keep-original">Keep original</option>
                          <option value="now">Now</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                        <CalendarClock className="h-4 w-4" />
                      </div>
                    </div>
                    {dateMode === "custom" ? (
                      <div className="mt-3">
                        <label htmlFor="custom-date-time" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Custom date and time
                        </label>
                        <input
                          id="custom-date-time"
                          type="datetime-local"
                          value={customDateTime}
                          onChange={(event) => setCustomDateTime(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Device</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label htmlFor="brand-select" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Brand
                        </label>
                        <select
                          id="brand-select"
                          value={selectedBrandId}
                          onChange={(event) => handleBrandChange(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          {devicePresets.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="device-select" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Device
                        </label>
                        <select
                          id="device-select"
                          value={selectedDeviceId}
                          onChange={(event) => handleDeviceChange(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          {(selectedBrand?.devices ?? []).map((device) => (
                            <option key={device.id} value={device.id}>
                              {device.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="camera-select" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Camera profile
                        </label>
                        <select
                          id="camera-select"
                          value={selectedCameraId}
                          onChange={(event) => setSelectedCameraId(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          {(selectedDevice?.cameras ?? []).map((camera) => (
                            <option key={camera.id} value={camera.id}>
                              {camera.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Prefill: {guidedDeviceDraft.cameraMake || "-"} {guidedDeviceDraft.cameraModel || ""}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="location-query" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Search location
                        </label>
                        <input
                          id="location-query"
                          value={locationQuery}
                          onChange={(event) => setLocationQuery(event.target.value)}
                          placeholder="e.g. Tokyo Tower"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={fillCoordinates}
                        disabled={isGeocoding}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-70"
                      >
                        {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => void openMapPicker()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
                      >
                        <MapPinned className="h-4 w-4" />
                        Pinpoint
                      </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label htmlFor="gps-latitude" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Latitude
                        </label>
                        <input
                          id="gps-latitude"
                          value={guidedGpsLatitude}
                          onChange={(event) => setGuidedGpsLatitude(event.target.value)}
                          placeholder="e.g. 35.6762"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="gps-longitude" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Longitude
                        </label>
                        <input
                          id="gps-longitude"
                          value={guidedGpsLongitude}
                          onChange={(event) => setGuidedGpsLongitude(event.target.value)}
                          placeholder="e.g. 139.6503"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="location-label" className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Location label
                        </label>
                        <input
                          id="location-label"
                          value={guidedLocationLabel}
                          onChange={(event) => setGuidedLocationLabel(event.target.value)}
                          placeholder="Readable place label"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Use decimal degrees for GPS values.</p>
                  </div>

                </div>

                <div className="mt-auto space-y-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setAdvancedModalOpen(true)}
                    className="inline-flex h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Circle className="h-4 w-4" />
                      Advanced metadata
                    </span>
                    {advancedModalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={runJob}
                    disabled={!canRunJob || !authToken}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {isSubmitting ? "Processing..." : "Apply Metadata"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>Status</span>
                <span>{jobProgress}%</span>
              </div>
              <div className="mb-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${jobProgress}%` }} />
              </div>
              <p className="text-sm text-slate-600">{statusMessage}</p>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={downloadResult}
                  disabled={!jobId || isSubmitting || jobProgress < 100 || !authToken}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowRight className="h-4 w-4" />
                  Download Result ZIP
                </button>
                {downloadSecondsLeft !== null && (
                  <span className="text-xs text-slate-400">
                    Available for {Math.floor(downloadSecondsLeft / 60)}:{String(downloadSecondsLeft % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {mapModalOpen ? (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-900/60 p-4">
          <div
            ref={mapModalPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-modal-title"
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="map-modal-title" className="text-lg font-bold text-slate-900">
                  Pinpoint location
                </h3>
                <p className="text-sm text-slate-500">Click anywhere on the map to pin exact coordinates.</p>
              </div>
              <button
                type="button"
                onClick={() => setMapModalOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <MapPicker center={mapCenter} pinnedPoint={mapPinnedPoint} onPin={setMapPinnedPoint} />

            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>
                Pinned: {(mapPinnedPoint ?? mapCenter)[0].toFixed(6)}, {(mapPinnedPoint ?? mapCenter)[1].toFixed(6)}
              </span>
              <button
                type="button"
                onClick={() => void applyPinnedLocation()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Use pinned location
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {advancedModalOpen ? (
        <div className="fixed inset-0 z-[84] grid place-items-center bg-slate-900/50 p-4">
          <div
            ref={advancedModalPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="advanced-modal-title"
            className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="advanced-modal-title" className="text-lg font-bold text-slate-900">
                  Advanced metadata
                </h3>
                <p className="text-sm text-slate-500">Guided fields are prefilled. You can override any value here.</p>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedModalOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capture</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="adv-date-time" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Date and time
                    </label>
                    <input
                      id="adv-date-time"
                      type="datetime-local"
                      value={formatExifToDateTimeLocal(mergedMetadataDraft.dateTimeOriginal)}
                      onChange={(event) => updateAdvancedField("dateTimeOriginal", formatDateTimeLocalToExif(event.target.value) ?? "")}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-camera-make" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Camera make
                    </label>
                    <input
                      id="adv-camera-make"
                      value={mergedMetadataDraft.cameraMake}
                      onChange={(event) => updateAdvancedField("cameraMake", event.target.value)}
                      placeholder="e.g. Apple"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-camera-model" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Camera model
                    </label>
                    <input
                      id="adv-camera-model"
                      value={mergedMetadataDraft.cameraModel}
                      onChange={(event) => updateAdvancedField("cameraModel", event.target.value)}
                      placeholder="e.g. iPhone 16 Pro"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lens and exposure</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="adv-lens-model" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Lens model
                    </label>
                    <input
                      id="adv-lens-model"
                      value={mergedMetadataDraft.lensModel}
                      onChange={(event) => updateAdvancedField("lensModel", event.target.value)}
                      placeholder="Lens model"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-iso" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      ISO
                    </label>
                    <input
                      id="adv-iso"
                      value={mergedMetadataDraft.iso}
                      onChange={(event) => updateAdvancedField("iso", event.target.value)}
                      placeholder="e.g. 100"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-focal-length" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Focal length (mm)
                    </label>
                    <input
                      id="adv-focal-length"
                      value={mergedMetadataDraft.focalLengthMm}
                      onChange={(event) => updateAdvancedField("focalLengthMm", event.target.value)}
                      placeholder="e.g. 24"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-aperture" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Aperture f-number
                    </label>
                    <input
                      id="adv-aperture"
                      value={mergedMetadataDraft.apertureFNumber}
                      onChange={(event) => updateAdvancedField("apertureFNumber", event.target.value)}
                      placeholder="e.g. 2.8"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-shutter" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Shutter speed
                    </label>
                    <input
                      id="adv-shutter"
                      value={mergedMetadataDraft.shutterSpeed}
                      onChange={(event) => updateAdvancedField("shutterSpeed", event.target.value)}
                      placeholder="e.g. 1/125"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-exposure" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Exposure compensation EV
                    </label>
                    <input
                      id="adv-exposure"
                      value={mergedMetadataDraft.exposureCompensationEv}
                      onChange={(event) => updateAdvancedField("exposureCompensationEv", event.target.value)}
                      placeholder="e.g. -0.3"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="adv-gps-lat" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Latitude
                    </label>
                    <input
                      id="adv-gps-lat"
                      value={mergedMetadataDraft.gpsLatitude}
                      onChange={(event) => updateAdvancedField("gpsLatitude", event.target.value)}
                      placeholder="e.g. 35.6762"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-gps-lng" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Longitude
                    </label>
                    <input
                      id="adv-gps-lng"
                      value={mergedMetadataDraft.gpsLongitude}
                      onChange={(event) => updateAdvancedField("gpsLongitude", event.target.value)}
                      placeholder="e.g. 139.6503"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-location-label" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Location label
                    </label>
                    <input
                      id="adv-location-label"
                      value={mergedMetadataDraft.locationLabel}
                      onChange={(event) => updateAdvancedField("locationLabel", event.target.value)}
                      placeholder="Readable location"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="adv-image-width" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Image width
                    </label>
                    <input
                      id="adv-image-width"
                      value={mergedMetadataDraft.imageWidth}
                      onChange={(event) => updateAdvancedField("imageWidth", event.target.value)}
                      placeholder="e.g. 4032"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-image-height" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Image height
                    </label>
                    <input
                      id="adv-image-height"
                      value={mergedMetadataDraft.imageHeight}
                      onChange={(event) => updateAdvancedField("imageHeight", event.target.value)}
                      placeholder="e.g. 3024"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-megapixels" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Megapixels
                    </label>
                    <input
                      id="adv-megapixels"
                      value={mergedMetadataDraft.megapixels}
                      onChange={(event) => updateAdvancedField("megapixels", event.target.value)}
                      placeholder="e.g. 12"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-title" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Title
                    </label>
                    <input
                      id="adv-title"
                      value={mergedMetadataDraft.title}
                      onChange={(event) => updateAdvancedField("title", event.target.value)}
                      placeholder="Asset title"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="adv-keywords" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Keywords
                    </label>
                    <input
                      id="adv-keywords"
                      value={mergedMetadataDraft.keywordsText}
                      onChange={(event) => updateAdvancedField("keywordsText", event.target.value)}
                      placeholder="Comma-separated keywords"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attribution</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor="adv-author" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Author
                    </label>
                    <input
                      id="adv-author"
                      value={mergedMetadataDraft.author}
                      onChange={(event) => updateAdvancedField("author", event.target.value)}
                      placeholder="Creator name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="adv-copyright" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Copyright
                    </label>
                    <input
                      id="adv-copyright"
                      value={mergedMetadataDraft.copyright}
                      onChange={(event) => updateAdvancedField("copyright", event.target.value)}
                      placeholder="e.g. 2026 John Doe"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label htmlFor="adv-caption" className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Caption
                    </label>
                    <textarea
                      id="adv-caption"
                      value={mergedMetadataDraft.caption}
                      onChange={(event) => updateAdvancedField("caption", event.target.value)}
                      placeholder="Describe the photo"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setAdvancedModalOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Save advanced settings
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWelcomeHero ? (
        <section className="border-y border-slate-200 bg-white py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything you need for clean archives</h2>
              <p className="mx-auto max-w-2xl text-lg text-slate-600">
                The most comprehensive metadata toolkit designed to ensure your photo library remains organized,
                professional, and private.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="group rounded-3xl border border-transparent bg-slate-50 p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-50"
                  onMouseEnter={() => setIsHovered(idx)}
                  onMouseLeave={() => setIsHovered(null)}
                >
                  <div className="mb-6 inline-flex rounded-2xl bg-white p-4 shadow-sm transition-all group-hover:bg-blue-600 group-hover:text-white">
                    <div className="transition-transform group-hover:scale-110">
                      {cloneElement(feature.icon, {
                        className: `h-7 w-7 ${isHovered === idx ? "text-white" : "text-blue-600"}`,
                      })}
                    </div>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showWelcomeHero ? (
        <section className="px-6 py-24 text-center">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 to-blue-600 p-10 shadow-2xl shadow-blue-200 md:p-16">
            <div className="absolute -mr-32 -mt-32 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Ready to fix your photo library?</h2>
              <p className="mx-auto max-w-xl text-lg text-blue-100">
                Join thousands of users who trust PhotoMaster for their digital preservation needs.
              </p>
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                className="rounded-xl bg-white px-8 py-3.5 text-lg font-semibold text-blue-700 shadow-lg transition-all hover:bg-slate-50"
              >
                Get Started for Free
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {authModalOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/50 p-4">
          <div
            ref={authModalPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="auth-modal-title" className="text-lg font-bold text-slate-900">
                  {authMode === "signup" ? "Create profile" : authMode === "account" ? "Account" : "Sign in"}
                </h3>
                <p className="text-sm text-slate-500">
                  {authMode === "signup"
                    ? "Create your profile with name and username."
                    : authMode === "account"
                      ? userEmail || "Authenticated session"
                      : "Authenticate to run uploads and processing."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Close
              </button>
            </div>

            {authMode === "signup" ? (
              <div className="space-y-3">
                <label htmlFor="signup-name" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Full name
                </label>
                <input
                  id="signup-name"
                  value={signUpName}
                  onChange={(event) => setSignUpName(event.target.value)}
                  placeholder="Full name"
                  name="signup-name"
                  autoComplete="section-signup name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <label htmlFor="signup-username" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Username
                </label>
                <input
                  id="signup-username"
                  value={signUpUsername}
                  onChange={(event) => {
                    setSignUpUsername(normalizeUsername(event.target.value));
                    setUsernameAvailability("idle");
                  }}
                  placeholder="Username (letters, numbers, dot, underscore)"
                  name="signup-username"
                  autoComplete="section-signup username"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                {signUpUsername ? (
                  <p
                    className={`text-xs ${!signUpUsernameValidation.valid
                      ? "text-rose-600"
                      : usernameAvailability === "taken"
                        ? "text-rose-600"
                        : "text-slate-500"
                      }`}
                  >
                    {!signUpUsernameValidation.valid
                      ? signUpUsernameValidation.error
                      : usernameAvailability === "taken"
                        ? "Username is already taken."
                        : "Username will be validated when you create profile."}
                  </p>
                ) : null}
                <label htmlFor="signup-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(event) => setSignUpEmail(event.target.value)}
                  placeholder="Email"
                  name="signup-email"
                  autoComplete="section-signup email"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <label htmlFor="signup-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(event) => setSignUpPassword(event.target.value)}
                  placeholder="Password"
                  name="signup-password"
                  autoComplete="section-signup new-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                {signUpPassword ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <ul className="space-y-1 text-xs">
                      {passwordRuleStatuses.map((rule) => (
                        <li key={rule.key} className={rule.valid ? "text-emerald-600" : "text-slate-500"}>
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <label htmlFor="signup-confirm-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Confirm password
                </label>
                <input
                  id="signup-confirm-password"
                  type="password"
                  value={signUpConfirmPassword}
                  onChange={(event) => setSignUpConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
                  name="signup-confirm-password"
                  autoComplete="section-signup new-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                {signUpConfirmPassword ? (
                  <p className={`text-xs ${passwordsMatch ? "text-emerald-600" : "text-rose-600"}`}>
                    {passwordsMatch ? "Passwords match." : "Passwords do not match."}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSignUp()}
                  disabled={!canSubmitSignUp}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {authPending ? "Creating profile..." : "Create profile"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGoogleSignUp()}
                  disabled={authPending || !signUpUsernameValidation.valid}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-70"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAuthFormState();
                    setAuthMode("signin");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="signin-email" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  placeholder="Email"
                  name="signin-email"
                  autoComplete="section-signin email"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <label htmlFor="signin-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  placeholder="Password"
                  name="signin-password"
                  autoComplete="section-signin current-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSignIn()}
                    disabled={authPending}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetAuthFormState();
                      setAuthMode("signup");
                    }}
                    disabled={authPending}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-70"
                  >
                    Sign up
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGoogleAuth()}
                  disabled={authPending}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-70"
                >
                  Continue with Google
                </button>
              </div>
            )}

            {authError ? <p className="mt-3 text-sm text-rose-600">{authError}</p> : null}
          </div>
        </div>
      ) : null}

      <footer className="border-t border-slate-200 bg-white px-6 py-12 text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-slate-300" />
            <span className="text-lg font-bold text-slate-900">
              Photo<span className="text-blue-600">Master</span>
            </span>
          </div>
          <div className="flex gap-8 text-sm font-medium">
            <a href="#" className="transition-colors hover:text-slate-900">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-slate-900">
              Terms
            </a>
            <a href="#" className="transition-colors hover:text-slate-900">
              Twitter
            </a>
            <a href="#" className="transition-colors hover:text-slate-900">
              Support
            </a>
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500/80">© 2024 PhotoMaster.</p>
        </div>
      </footer>

      {errorPopup !== null && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 shadow-2xl"
          >
            <h3 className="mb-2 text-base font-bold text-slate-900">Upload expired</h3>
            <p className="mb-5 text-sm text-slate-600">{errorPopup}</p>
            <button
              type="button"
              onClick={() => setErrorPopup(null)}
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Re-upload and retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
