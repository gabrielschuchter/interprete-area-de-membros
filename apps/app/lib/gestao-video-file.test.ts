import { describe, expect, it } from "vitest";
import {
  gestaoVideoExtension,
  hasGestaoVideoSignature,
  isGestaoVideoMimeType,
  normalizeGestaoVideoFileName,
} from "./gestao-video-file";

describe("Gestão private video file validation", () => {
  it("accepts only the supported video MIME types and chooses matching extensions", () => {
    expect(isGestaoVideoMimeType("video/mp4")).toBe(true);
    expect(isGestaoVideoMimeType("video/webm")).toBe(true);
    expect(isGestaoVideoMimeType("video/quicktime")).toBe(false);
    expect(gestaoVideoExtension("video/mp4")).toBe("mp4");
    expect(gestaoVideoExtension("video/webm")).toBe("webm");
  });

  it("normalizes path-bearing names before storing an upload label", () => {
    expect(
      normalizeGestaoVideoFileName("C:\\fakepath\\Vídeo do módulo.mp4")
    ).toBe("Vídeo do módulo.mp4");
    expect(normalizeGestaoVideoFileName("../../.mp4")).toBe(".mp4");
    expect(normalizeGestaoVideoFileName("???")).toBe("---");
  });

  it("checks the MP4 and WebM container signatures rather than trusting the extension", () => {
    const mp4 = new Uint8Array(16);
    mp4.set([0x66, 0x74, 0x79, 0x70], 4);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
    expect(hasGestaoVideoSignature("video/mp4", mp4)).toBe(true);
    expect(hasGestaoVideoSignature("video/webm", webm)).toBe(true);
    expect(hasGestaoVideoSignature("video/mp4", webm)).toBe(false);
    expect(hasGestaoVideoSignature("video/webm", mp4)).toBe(false);
    expect(hasGestaoVideoSignature("video/mp4", mp4.slice(0, 8))).toBe(false);
  });
});
