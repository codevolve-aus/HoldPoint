import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

/** Shrinks a camera photo to max 1600 px on the long side, JPEG ~0.8. Keeps uploads small on site. */
export async function compress(file: File, maxSide = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}

/** Uploads a photo for a submission field. Returns the storage path saved in the form. */
export async function uploadPhoto(submissionId: string, fieldPath: string, file: File): Promise<string> {
  const blob = await compress(file);
  const path = `photos/${submissionId}/${fieldPath.replace(/[^\w.-]/g, '_')}_${Date.now()}.jpg`;
  await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
  return path;
}

const urlCache = new Map<string, string>();
export async function photoURL(path: string): Promise<string> {
  if (!urlCache.has(path)) urlCache.set(path, await getDownloadURL(ref(storage, path)));
  return urlCache.get(path)!;
}

/** Loads a photo as a data URL so it can be placed in the PDF. */
export async function photoDataURL(path: string): Promise<string | null> {
  try {
    const res = await fetch(await photoURL(path));
    const blob = await res.blob();
    return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(blob); });
  } catch { return null; }
}
