import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const targetUrl = process.env.WALKING_PAW_SITE_URL || "https://walking-paw.pages.dev/";
const outputDir = new URL("../public/", import.meta.url);

await mkdir(outputDir, { recursive: true });

await QRCode.toFile(fileURLToPath(new URL("walking-paw-qr.svg", outputDir)), targetUrl, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 2,
  color: {
    dark: "#07345d",
    light: "#ffffff"
  }
});

await QRCode.toFile(fileURLToPath(new URL("walking-paw-qr.png", outputDir)), targetUrl, {
  type: "png",
  errorCorrectionLevel: "H",
  margin: 2,
  width: 1400,
  color: {
    dark: "#07345d",
    light: "#ffffff"
  }
});

console.log(`Generated QR code for ${targetUrl}`);
