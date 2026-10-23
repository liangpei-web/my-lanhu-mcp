/** 只读文件头解析 PNG / JPEG / WebP / GIF 像素尺寸（不引入图片库） */

export interface ImageSize {
  width: number;
  height: number;
}

function readPngSize(buf: Buffer): ImageSize | undefined {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString("ascii", 12, 16) !== "IHDR") {
    return undefined;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readGifSize(buf: Buffer): ImageSize | undefined {
  if (buf.length < 10 || buf.toString("ascii", 0, 3) !== "GIF") {
    return undefined;
  }
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readJpegSize(buf: Buffer): ImageSize | undefined {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

function readWebpSize(buf: Buffer): ImageSize | undefined {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    return undefined;
  }
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  return undefined;
}

export function readImageSize(buf: Buffer): ImageSize | undefined {
  return readPngSize(buf) ?? readJpegSize(buf) ?? readWebpSize(buf) ?? readGifSize(buf);
}
