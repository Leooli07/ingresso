function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createQrCodeDataUrl(content: string) {
  const safeContent = escapeXml(content);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#ffffff" />
      <rect x="16" y="16" width="208" height="208" rx="12" fill="#111827" />
      <rect x="36" y="36" width="56" height="56" fill="#ffffff" />
      <rect x="148" y="36" width="56" height="56" fill="#ffffff" />
      <rect x="36" y="148" width="56" height="56" fill="#ffffff" />
      <text x="120" y="126" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" fill="#ffffff">
        QR
      </text>
      <text x="120" y="214" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#d1d5db">
        ${safeContent}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
