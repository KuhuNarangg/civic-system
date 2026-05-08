/**
 * Compress an image file using the Canvas API before upload.
 * Returns a Promise<Blob> resized to maxWidth (preserves aspect ratio).
 */
export const compressImage = (file, maxWidth = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));

    const canvas = document.createElement('canvas');
    const img = new Image();

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          // Wrap blob in a File so multer accepts it as an image upload
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '') + '.jpg',
            { type: 'image/jpeg', lastModified: Date.now() }
          );
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
};
