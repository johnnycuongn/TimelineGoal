/**
 * Corner photos — pick, squeeze, upload, resolve.
 *
 * Everything lands under couples/{coupleId}/… (membership-gated in
 * storage.rules, image-only, <10MB). We compress client-side before upload —
 * long edge ≤1600px, JPEG q0.78 — to keep the Spark tier comfy (see the
 * firebase skill: untouched camera JPGs would burn the daily transfer cap).
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import { useEffect, useState } from 'react';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Open the system photo library. Resolves null if they change their mind. */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 1,
    allowsMultipleSelection: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

/** Shrink to ≤1600px long edge + JPEG — returns a local file uri. */
export async function compressPhoto(photo: PickedPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const longEdge = Math.max(photo.width, photo.height);
  if (longEdge > MAX_EDGE) {
    const scale = MAX_EDGE / longEdge;
    context.resize({ width: Math.round(photo.width * scale) });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Upload a local image into the couple's Storage folder.
 * Returns the storage PATH (the canonical reference we keep in Firestore).
 */
export async function uploadCouplePhoto(
  storage: FirebaseStorage,
  params: { coupleId: string; folder: string; localUri: string },
): Promise<string> {
  const { coupleId, folder, localUri } = params;
  const path = `couples/${coupleId}/${folder}/${Date.now()}.jpg`;
  // NATIVE blob via XHR — the one reliable route on RN/Hermes. Everything else
  // corrupts (found the hard way, blank stickers each time): fetch(file://)
  // yields a junk ~20-byte blob; uploadBytes(expo File.bytes()) and even
  // uploadString(base64) end up storing the base64 TEXT of the image. RN's XHR
  // reads file:// into a blob-manager-backed Blob that the Firebase SDK can
  // hand to the network layer without any JS byte munging.
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError('Could not read the photo file'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri, true);
    xhr.send(null);
  });
  await uploadBytes(storageRef(storage, path), blob, { contentType: 'image/jpeg' });
  return path;
}

/** One-stop: pick → compress → upload. Null if the picker was dismissed. */
export async function pickCompressUpload(
  storage: FirebaseStorage,
  params: { coupleId: string; folder: string },
): Promise<string | null> {
  const picked = await pickPhoto();
  if (!picked) return null;
  const squeezed = await compressPhoto(picked);
  return uploadCouplePhoto(storage, { ...params, localUri: squeezed });
}

// Download URLs are stable per path — cache them for the session so lists
// of photo pins don't re-resolve on every mount.
const urlCache = new Map<string, string>();

/** Resolve a storage path to a display URL (cached). Null while loading/absent. */
export function useStorageUrl(path: string | null | undefined, storage: FirebaseStorage): string | null {
  const [url, setUrl] = useState<string | null>(path ? (urlCache.get(path) ?? null) : null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = urlCache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    getDownloadURL(storageRef(storage, path))
      .then((resolved) => {
        urlCache.set(path, resolved);
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, storage]);

  return url;
}
