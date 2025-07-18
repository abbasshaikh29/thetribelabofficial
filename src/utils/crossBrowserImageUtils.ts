/**
 * Cross-browser image utilities
 */

/**
 * Adds cache busting parameters to an image URL
 * @param url The original image URL
 * @returns The URL with cache-busting parameters
 */
export const addCacheBusting = (url: string): string => {
  if (!url) return url;

  // Skip cache busting for Google profile images
  if (url.includes("googleusercontent.com")) {
    return url;
  }

  // Skip cache busting for S3 URLs with query parameters
  if (url.includes("amazonaws.com") && url.includes("?")) {
    return url;
  }

  const timestamp = Date.now();
  return url.includes("?") ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;
};

/**
 * Preloads an image to ensure it's in the browser cache
 * @param url The image URL to preload
 */
export const preloadImage = (url: string): void => {
  if (!url) return;

  // Create a new image element
  const img = new Image();

  // Set the source to preload the image
  img.src = addCacheBusting(url);
};

/**
 * Checks if an image URL is valid and accessible
 * @param url The image URL to check
 * @returns Promise that resolves to true if the image is valid, false otherwise
 */
export const isImageValid = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const img = new Image();

    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);

    img.src = addCacheBusting(url);
  });
};

/**
 * Generates a random color from a predefined palette
 * @returns A random color hex code
 */
const getRandomColor = (): string => {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FFEAA7", // Yellow
    "#DDA0DD", // Plum
    "#98D8C8", // Mint
    "#F7DC6F", // Light yellow
    "#BB8FCE", // Light purple
    "#85C1E9", // Light blue
    "#F8C471", // Orange
    "#82E0AA", // Light green
    "#F1948A", // Pink
    "#85C1E9", // Sky blue
    "#D2B4DE", // Lavender
    "#AED6F1", // Powder blue
    "#A9DFBF", // Sage
    "#F9E79F", // Cream
    "#FADBD8", // Blush
    "#D5DBDB", // Silver
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Creates a data URL for a fallback avatar with the first letter of the name
 * @param name The name to use for the fallback
 * @param bgColor Background color (if not provided, uses random color)
 * @param textColor Text color (default: white)
 * @returns A data URL for the fallback avatar
 */
export const createFallbackAvatar = (
  name: string = "?",
  bgColor?: string,
  textColor: string = "#ffffff"
): string => {
  // For server-side rendering, return empty string
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Use provided background color or generate a random one
  const backgroundColor = bgColor || getRandomColor();

  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  const letter = name.charAt(0).toUpperCase();
  ctx.fillStyle = textColor;
  ctx.font = "bold 100px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL("image/png");
};
