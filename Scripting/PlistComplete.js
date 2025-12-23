/**
 * plist-lite-enhanced - ES Module Version
 * A lightweight plist parser and builder with binary plist support
 *
 * API:
 * - parse(input) - 解析 XML 或二进制 plist
 * - build(obj, options) - 生成 XML 或二进制 plist
 */

// ============ 主 API ============

/**
 * 解析 plist 文件（自动检测格式）
 * @param {string|Uint8Array|ArrayBuffer} input - plist 数据
 * @returns {*} 解析后的对象
 */
export function parse(input) {
  // 判断是二进制还是 XML
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input);
    const header = String.fromCharCode.apply(null, data.slice(0, 8));

    if (header.startsWith("bplist")) {
      return parseBinary(data);
    } else {
      // 尝试作为 XML 解析
      const text = new TextDecoder().decode(data);
      return parseXml(text);
    }
  }

  // 字符串输入
  if (typeof input === "string") {
    if (input.startsWith("bplist")) {
      // 二进制字符串
      const bytes = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) {
        bytes[i] = input.charCodeAt(i);
      }
      return parseBinary(bytes);
    }
    return parseXml(input);
  }

  throw new Error("Unsupported input format");
}

/**
 * 生成 plist 文件
 * @param {*} obj - 要序列化的对象
 * @param {Object} options - 配置选项
 * @param {string} options.format - 'xml' 或 'binary'，默认 'xml'
 * @param {boolean} options.pretty - XML 格式化（仅 XML），默认 true
 * @param {string} options.indent - 缩进字符串（仅 XML），默认 '  '
 * @returns {string|Uint8Array} XML 字符串或二进制数据
 */
export function build(obj, options = {}) {
  const format = options.format || "xml";

  if (format === "binary") {
    return buildBinary(obj);
  } else if (format === "xml") {
    return buildXml(obj, options);
  } else {
    throw new Error(`Unknown format: ${format}`);
  }
}

// ============ XML Parser ============

function parseXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  if (doc.documentElement.nodeName === "parsererror") {
    throw new Error("Invalid XML document");
  }

  const plistNode = doc.documentElement;
  if (plistNode.nodeName !== "plist") {
    throw new Error("Not a valid plist document");
  }

  const children = getChildElements(plistNode);
  return children.length === 1
    ? parseXmlNode(children[0])
    : children.map(parseXmlNode);
}

function getChildElements(node) {
  const children = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      // ELEMENT_NODE
      children.push(child);
    }
  }
  return children;
}

function parseXmlNode(node) {
  const nodeName = node.nodeName;

  switch (nodeName) {
    case "dict":
      return parseXmlDict(node);
    case "array":
      return parseXmlArray(node);
    case "string":
      return getTextContent(node);
    case "integer":
      return parseInt(getTextContent(node), 10);
    case "real":
      return parseFloat(getTextContent(node));
    case "true":
      return true;
    case "false":
      return false;
    case "date":
      return new Date(getTextContent(node));
    case "data":
      return parseBase64(getTextContent(node));
    default:
      return null;
  }
}

function parseXmlDict(node) {
  const dict = {};
  const children = getChildElements(node);

  for (let i = 0; i < children.length; i += 2) {
    const keyNode = children[i];
    const valueNode = children[i + 1];

    if (keyNode.nodeName !== "key") {
      throw new Error("Expected key element in dict");
    }

    const key = getTextContent(keyNode);
    const value = valueNode ? parseXmlNode(valueNode) : null;
    dict[key] = value;
  }

  return dict;
}

function parseXmlArray(node) {
  const array = [];
  const children = getChildElements(node);

  for (let i = 0; i < children.length; i++) {
    array.push(parseXmlNode(children[i]));
  }

  return array;
}

function getTextContent(node) {
  let text = "";
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3 || child.nodeType === 4) {
      // TEXT_NODE or CDATA
      text += child.nodeValue;
    }
  }
  return text.trim();
}

function parseBase64(str) {
  const cleanStr = str.replace(/\s+/g, "");

  if (typeof atob !== "undefined") {
    const binaryStr = atob(cleanStr);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(cleanStr, "base64");
  }

  throw new Error("Base64 decoding not supported in this environment");
}

// ============ Binary Parser ============

function parseBinary(buffer) {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // 验证魔数
  const header = String.fromCharCode.apply(null, data.slice(0, 8));
  if (!header.startsWith("bplist")) {
    throw new Error("Not a valid binary plist file");
  }

  // 读取尾部信息
  const trailerOffset = data.length - 32;
  const trailer = new DataView(
    data.buffer,
    data.byteOffset + trailerOffset,
    32
  );

  const offsetIntSize = trailer.getUint8(6);
  const objectRefSize = trailer.getUint8(7);
  const numObjects = readUInt64(trailer, 8);
  const topObject = readUInt64(trailer, 16);
  const offsetTableOffset = readUInt64(trailer, 24);

  // 读取偏移表
  const offsetTable = [];
  for (let i = 0; i < numObjects; i++) {
    const offset = offsetTableOffset + i * offsetIntSize;
    offsetTable.push(readInteger(data, offset, offsetIntSize));
  }

  // 解析对象
  const parsedObjects = new Array(numObjects);
  const parser = new BinaryPlistParser(
    data,
    offsetTable,
    objectRefSize,
    parsedObjects
  );

  return parser.parseObject(topObject);
}

class BinaryPlistParser {
  constructor(data, offsetTable, objectRefSize, parsedObjects) {
    this.data = data;
    this.offsetTable = offsetTable;
    this.objectRefSize = objectRefSize;
    this.parsedObjects = parsedObjects;
  }

  parseObject(objIndex) {
    if (this.parsedObjects[objIndex] !== undefined) {
      return this.parsedObjects[objIndex];
    }

    const offset = this.offsetTable[objIndex];
    const marker = this.data[offset];
    const type = (marker & 0xf0) >> 4;
    const info = marker & 0x0f;

    let result;

    switch (type) {
      case 0x0:
        if (info === 0x00) result = null;
        else if (info === 0x08) result = false;
        else if (info === 0x09) result = true;
        else if (info === 0x0f) result = null;
        else
          throw new Error(`Unknown primitive type: 0x${marker.toString(16)}`);
        break;
      case 0x1:
        result = this.parseInteger(offset + 1, 1 << info);
        break;
      case 0x2:
        result = this.parseReal(offset + 1, 1 << info);
        break;
      case 0x3:
        result = this.parseDate(offset + 1);
        break;
      case 0x4:
        result = this.parseData(offset, info);
        break;
      case 0x5:
        result = this.parseAsciiString(offset, info);
        break;
      case 0x6:
        result = this.parseUtf16String(offset, info);
        break;
      case 0x8:
        result = this.parseInteger(offset + 1, info + 1);
        break;
      case 0xa:
        result = this.parseArray(offset, info);
        break;
      case 0xd:
        result = this.parseDict(offset, info);
        break;
      default:
        throw new Error(`Unknown object type: 0x${type.toString(16)}`);
    }

    this.parsedObjects[objIndex] = result;
    return result;
  }

  parseInteger(offset, byteCount) {
    if (byteCount === 1) {
      return this.data[offset];
    } else if (byteCount === 2) {
      return new DataView(
        this.data.buffer,
        this.data.byteOffset + offset,
        2
      ).getUint16(0);
    } else if (byteCount === 4) {
      return new DataView(
        this.data.buffer,
        this.data.byteOffset + offset,
        4
      ).getUint32(0);
    } else if (byteCount === 8) {
      const view = new DataView(
        this.data.buffer,
        this.data.byteOffset + offset,
        8
      );
      const high = view.getUint32(0);
      const low = view.getUint32(4);
      return high * 0x100000000 + low;
    }
    throw new Error(`Unsupported integer size: ${byteCount}`);
  }

  parseReal(offset, byteCount) {
    const view = new DataView(
      this.data.buffer,
      this.data.byteOffset + offset,
      byteCount
    );
    if (byteCount === 4) {
      return view.getFloat32(0);
    } else if (byteCount === 8) {
      return view.getFloat64(0);
    }
    throw new Error(`Unsupported real size: ${byteCount}`);
  }

  parseDate(offset) {
    const view = new DataView(
      this.data.buffer,
      this.data.byteOffset + offset,
      8
    );
    const timestamp = view.getFloat64(0);
    const appleEpoch = new Date("2001-01-01T00:00:00Z").getTime();
    return new Date(appleEpoch + timestamp * 1000);
  }

  parseData(offset, info) {
    let length = info;
    let dataOffset = offset + 1;

    if (info === 0x0f) {
      const lengthInfo = this.parseLength(offset + 1);
      length = lengthInfo.value;
      dataOffset = lengthInfo.offset;
    }

    return this.data.slice(dataOffset, dataOffset + length);
  }

  parseAsciiString(offset, info) {
    let length = info;
    let strOffset = offset + 1;

    if (info === 0x0f) {
      const lengthInfo = this.parseLength(offset + 1);
      length = lengthInfo.value;
      strOffset = lengthInfo.offset;
    }

    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.data[strOffset + i]);
    }
    return str;
  }

  parseUtf16String(offset, info) {
    let length = info;
    let strOffset = offset + 1;

    if (info === 0x0f) {
      const lengthInfo = this.parseLength(offset + 1);
      length = lengthInfo.value;
      strOffset = lengthInfo.offset;
    }

    let str = "";
    for (let i = 0; i < length; i++) {
      const charCode = new DataView(
        this.data.buffer,
        this.data.byteOffset + strOffset + i * 2,
        2
      ).getUint16(0);
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  parseArray(offset, info) {
    let count = info;
    let objOffset = offset + 1;

    if (info === 0x0f) {
      const lengthInfo = this.parseLength(offset + 1);
      count = lengthInfo.value;
      objOffset = lengthInfo.offset;
    }

    const array = [];
    for (let i = 0; i < count; i++) {
      const objRef = readInteger(
        this.data,
        objOffset + i * this.objectRefSize,
        this.objectRefSize
      );
      array.push(this.parseObject(objRef));
    }

    return array;
  }

  parseDict(offset, info) {
    let count = info;
    let objOffset = offset + 1;

    if (info === 0x0f) {
      const lengthInfo = this.parseLength(offset + 1);
      count = lengthInfo.value;
      objOffset = lengthInfo.offset;
    }

    const dict = {};
    const keyOffset = objOffset;
    const valOffset = objOffset + count * this.objectRefSize;

    for (let i = 0; i < count; i++) {
      const keyRef = readInteger(
        this.data,
        keyOffset + i * this.objectRefSize,
        this.objectRefSize
      );
      const valRef = readInteger(
        this.data,
        valOffset + i * this.objectRefSize,
        this.objectRefSize
      );

      const key = this.parseObject(keyRef);
      const value = this.parseObject(valRef);

      dict[key] = value;
    }

    return dict;
  }

  parseLength(offset) {
    const marker = this.data[offset];
    const lengthType = (marker & 0xf0) >> 4;
    const lengthInfo = marker & 0x0f;

    if (lengthType !== 0x1) {
      throw new Error("Invalid length marker");
    }

    const byteCount = 1 << lengthInfo;
    const length = this.parseInteger(offset + 1, byteCount);

    return {
      value: length,
      offset: offset + 1 + byteCount,
    };
  }
}

function readInteger(data, offset, size) {
  let result = 0;
  for (let i = 0; i < size; i++) {
    result = (result << 8) | data[offset + i];
  }
  return result;
}

function readUInt64(view, offset) {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 0x100000000 + low;
}

// ============ XML Builder ============

function buildXml(obj, options = {}) {
  const pretty = options.pretty !== false;
  const indent = options.indent || "  ";
  const newline = pretty ? "\n" : "";

  let xml = '<?xml version="1.0" encoding="UTF-8"?>' + newline;
  xml +=
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' +
    newline;
  xml += '<plist version="1.0">' + newline;
  xml += buildXmlNode(obj, pretty ? 1 : 0, indent, newline);
  xml += "</plist>" + newline;

  return xml;
}

function buildXmlNode(value, level, indent, newline) {
  const spaces = indent.repeat(level);
  const type = getType(value);

  switch (type) {
    case "object":
      return buildXmlDict(value, level, indent, newline);
    case "array":
      return buildXmlArray(value, level, indent, newline);
    case "string":
      return spaces + "<string>" + escapeXml(value) + "</string>" + newline;
    case "number":
      return buildXmlNumber(value, spaces, newline);
    case "boolean":
      return spaces + (value ? "<true/>" : "<false/>") + newline;
    case "date":
      return spaces + "<date>" + formatDate(value) + "</date>" + newline;
    case "buffer":
      return (
        spaces +
        "<data>" +
        newline +
        formatBase64(value, level + 1, indent, newline) +
        spaces +
        "</data>" +
        newline
      );
    default:
      return "";
  }
}

function buildXmlDict(obj, level, indent, newline) {
  const spaces = indent.repeat(level);
  let xml = spaces + "<dict>" + newline;

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      xml += spaces + indent + "<key>" + escapeXml(key) + "</key>" + newline;
      xml += buildXmlNode(obj[key], level + 1, indent, newline);
    }
  }

  xml += spaces + "</dict>" + newline;
  return xml;
}

function buildXmlArray(arr, level, indent, newline) {
  const spaces = indent.repeat(level);
  let xml = spaces + "<array>" + newline;

  for (let i = 0; i < arr.length; i++) {
    xml += buildXmlNode(arr[i], level + 1, indent, newline);
  }

  xml += spaces + "</array>" + newline;
  return xml;
}

function buildXmlNumber(value, spaces, newline) {
  if (Number.isInteger(value)) {
    return spaces + "<integer>" + value + "</integer>" + newline;
  } else {
    return spaces + "<real>" + value + "</real>" + newline;
  }
}

function getType(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return "buffer";
  if (value instanceof Uint8Array || value instanceof ArrayBuffer)
    return "buffer";
  return typeof value;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date) {
  const pad = (n) => (n < 10 ? "0" + n : n);

  return (
    date.getUTCFullYear() +
    "-" +
    pad(date.getUTCMonth() + 1) +
    "-" +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    ":" +
    pad(date.getUTCMinutes()) +
    ":" +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function formatBase64(data, level, indent, newline) {
  let base64;

  if (typeof btoa !== "undefined") {
    if (data instanceof Uint8Array) {
      let binary = "";
      for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
      }
      base64 = btoa(binary);
    } else {
      base64 = btoa(String(data));
    }
  } else if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(data).toString("base64");
  } else {
    throw new Error("Base64 encoding not supported in this environment");
  }

  const spaces = indent.repeat(level);
  const lines = [];
  for (let i = 0; i < base64.length; i += 68) {
    lines.push(spaces + base64.substr(i, 68));
  }

  return lines.join(newline) + newline;
}

// ============ Binary Builder ============

function buildBinary(obj) {
  const builder = new BinaryPlistBuilder();
  return builder.build(obj);
}

class BinaryPlistBuilder {
  constructor() {
    this.objects = [];
    this.objectMap = new Map();
    this.stringCache = new Map();
  }

  build(rootObj) {
    // 收集所有唯一对象
    this.collectObjects(rootObj);

    // 计算引用大小
    const objectRefSize = this.calculateRefSize(this.objects.length);

    // 序列化对象并记录偏移
    const objectData = [];
    const offsets = [];
    let currentOffset = 8; // 文件头大小

    for (const obj of this.objects) {
      offsets.push(currentOffset);
      const data = this.serializeObject(obj, objectRefSize);
      objectData.push(data);
      currentOffset += data.length;
    }

    // 计算偏移表大小
    const offsetIntSize = this.calculateRefSize(currentOffset);

    // 构建偏移表
    const offsetTable = [];
    for (const offset of offsets) {
      offsetTable.push(...this.writeInteger(offset, offsetIntSize));
    }

    const offsetTableOffset = currentOffset;

    // 构建尾部（32 字节）
    const trailer = new Uint8Array(32);
    const trailerView = new DataView(trailer.buffer);

    trailerView.setUint8(6, offsetIntSize);
    trailerView.setUint8(7, objectRefSize);
    this.writeUInt64(trailerView, 8, this.objects.length);
    this.writeUInt64(trailerView, 16, 0); // topObject 总是索引 0
    this.writeUInt64(trailerView, 24, offsetTableOffset);

    // 组合所有部分
    const header = new TextEncoder().encode("bplist00");
    const totalSize =
      header.length +
      objectData.reduce((sum, d) => sum + d.length, 0) +
      offsetTable.length +
      trailer.length;
    const result = new Uint8Array(totalSize);

    let pos = 0;
    result.set(header, pos);
    pos += header.length;

    for (const data of objectData) {
      result.set(data, pos);
      pos += data.length;
    }

    result.set(offsetTable, pos);
    pos += offsetTable.length;

    result.set(trailer, pos);

    return result;
  }

  collectObjects(obj) {
    // 避免重复收集
    const objStr = JSON.stringify(obj);
    if (this.objectMap.has(objStr)) {
      return this.objectMap.get(objStr);
    }

    const index = this.objects.length;
    this.objectMap.set(objStr, index);
    this.objects.push(obj);

    // 递归收集子对象
    if (
      obj !== null &&
      typeof obj === "object" &&
      !(obj instanceof Date) &&
      !(obj instanceof Uint8Array)
    ) {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          this.collectObjects(item);
        }
      } else {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            this.collectObjects(key); // 字典的键也是对象
            this.collectObjects(obj[key]);
          }
        }
      }
    }

    return index;
  }

  serializeObject(obj, objectRefSize) {
    const type = getType(obj);

    switch (type) {
      case "null":
        return new Uint8Array([0x00]);
      case "boolean":
        return new Uint8Array([obj ? 0x09 : 0x08]);
      case "number":
        return this.serializeNumber(obj);
      case "string":
        return this.serializeString(obj);
      case "date":
        return this.serializeDate(obj);
      case "buffer":
        return this.serializeData(obj);
      case "array":
        return this.serializeArray(obj, objectRefSize);
      case "object":
        return this.serializeDict(obj, objectRefSize);
      default:
        throw new Error(`Cannot serialize type: ${type}`);
    }
  }

  serializeNumber(num) {
    if (Number.isInteger(num)) {
      // 整数
      if (num >= 0 && num < 256) {
        return new Uint8Array([0x10, num]);
      } else if (num >= 0 && num < 65536) {
        const arr = new Uint8Array(3);
        arr[0] = 0x11;
        new DataView(arr.buffer).setUint16(1, num);
        return arr;
      } else if (num >= 0 && num < 4294967296) {
        const arr = new Uint8Array(5);
        arr[0] = 0x12;
        new DataView(arr.buffer).setUint32(1, num);
        return arr;
      } else {
        // 64位整数
        const arr = new Uint8Array(9);
        arr[0] = 0x13;
        const view = new DataView(arr.buffer);
        const high = Math.floor(num / 0x100000000);
        const low = num >>> 0;
        view.setUint32(1, high);
        view.setUint32(5, low);
        return arr;
      }
    } else {
      // 浮点数
      const arr = new Uint8Array(9);
      arr[0] = 0x23;
      new DataView(arr.buffer).setFloat64(1, num);
      return arr;
    }
  }

  serializeString(str) {
    // 检查是否为 ASCII
    let isAscii = true;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127) {
        isAscii = false;
        break;
      }
    }

    if (isAscii) {
      // ASCII 字符串
      if (str.length < 15) {
        const arr = new Uint8Array(1 + str.length);
        arr[0] = 0x50 | str.length;
        for (let i = 0; i < str.length; i++) {
          arr[1 + i] = str.charCodeAt(i);
        }
        return arr;
      } else {
        // 长字符串需要额外的长度标记
        const lengthBytes = this.serializeInteger(str.length);
        const arr = new Uint8Array(1 + lengthBytes.length + str.length);
        arr[0] = 0x5f;
        arr.set(lengthBytes, 1);
        for (let i = 0; i < str.length; i++) {
          arr[1 + lengthBytes.length + i] = str.charCodeAt(i);
        }
        return arr;
      }
    } else {
      // UTF-16 字符串
      if (str.length < 15) {
        const arr = new Uint8Array(1 + str.length * 2);
        arr[0] = 0x60 | str.length;
        const view = new DataView(arr.buffer);
        for (let i = 0; i < str.length; i++) {
          view.setUint16(1 + i * 2, str.charCodeAt(i));
        }
        return arr;
      } else {
        const lengthBytes = this.serializeInteger(str.length);
        const arr = new Uint8Array(1 + lengthBytes.length + str.length * 2);
        arr[0] = 0x6f;
        arr.set(lengthBytes, 1);
        const view = new DataView(arr.buffer);
        for (let i = 0; i < str.length; i++) {
          view.setUint16(1 + lengthBytes.length + i * 2, str.charCodeAt(i));
        }
        return arr;
      }
    }
  }

  serializeDate(date) {
    const arr = new Uint8Array(9);
    arr[0] = 0x33;
    const appleEpoch = new Date("2001-01-01T00:00:00Z").getTime();
    const timestamp = (date.getTime() - appleEpoch) / 1000;
    new DataView(arr.buffer).setFloat64(1, timestamp);
    return arr;
  }

  serializeData(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    if (bytes.length < 15) {
      const arr = new Uint8Array(1 + bytes.length);
      arr[0] = 0x40 | bytes.length;
      arr.set(bytes, 1);
      return arr;
    } else {
      const lengthBytes = this.serializeInteger(bytes.length);
      const arr = new Uint8Array(1 + lengthBytes.length + bytes.length);
      arr[0] = 0x4f;
      arr.set(lengthBytes, 1);
      arr.set(bytes, 1 + lengthBytes.length);
      return arr;
    }
  }

  serializeArray(arr, objectRefSize) {
    const count = arr.length;
    const refs = arr.map((item) => this.objectMap.get(JSON.stringify(item)));

    let header;
    if (count < 15) {
      header = new Uint8Array([0xa0 | count]);
    } else {
      const lengthBytes = this.serializeInteger(count);
      header = new Uint8Array(1 + lengthBytes.length);
      header[0] = 0xaf;
      header.set(lengthBytes, 1);
    }

    const refBytes = new Uint8Array(count * objectRefSize);
    for (let i = 0; i < count; i++) {
      const refData = this.writeInteger(refs[i], objectRefSize);
      refBytes.set(refData, i * objectRefSize);
    }

    const result = new Uint8Array(header.length + refBytes.length);
    result.set(header, 0);
    result.set(refBytes, header.length);
    return result;
  }

  serializeDict(obj, objectRefSize) {
    const keys = Object.keys(obj).filter((k) => obj.hasOwnProperty(k));
    const count = keys.length;

    const keyRefs = keys.map((k) => this.objectMap.get(JSON.stringify(k)));
    const valRefs = keys.map((k) => this.objectMap.get(JSON.stringify(obj[k])));

    let header;
    if (count < 15) {
      header = new Uint8Array([0xd0 | count]);
    } else {
      const lengthBytes = this.serializeInteger(count);
      header = new Uint8Array(1 + lengthBytes.length);
      header[0] = 0xdf;
      header.set(lengthBytes, 1);
    }

    const refBytes = new Uint8Array(count * 2 * objectRefSize);
    for (let i = 0; i < count; i++) {
      const keyData = this.writeInteger(keyRefs[i], objectRefSize);
      refBytes.set(keyData, i * objectRefSize);
    }
    for (let i = 0; i < count; i++) {
      const valData = this.writeInteger(valRefs[i], objectRefSize);
      refBytes.set(valData, (count + i) * objectRefSize);
    }

    const result = new Uint8Array(header.length + refBytes.length);
    result.set(header, 0);
    result.set(refBytes, header.length);
    return result;
  }

  serializeInteger(num) {
    if (num < 256) {
      return new Uint8Array([0x10, num]);
    } else if (num < 65536) {
      const arr = new Uint8Array(3);
      arr[0] = 0x11;
      new DataView(arr.buffer).setUint16(1, num);
      return arr;
    } else {
      const arr = new Uint8Array(5);
      arr[0] = 0x12;
      new DataView(arr.buffer).setUint32(1, num);
      return arr;
    }
  }

  calculateRefSize(count) {
    if (count < 256) return 1;
    if (count < 65536) return 2;
    return 4;
  }

  writeInteger(value, size) {
    const arr = new Uint8Array(size);
    for (let i = size - 1; i >= 0; i--) {
      arr[i] = value & 0xff;
      value >>= 8;
    }
    return arr;
  }

  writeUInt64(view, offset, value) {
    const high = Math.floor(value / 0x100000000);
    const low = value >>> 0;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
  }
}
