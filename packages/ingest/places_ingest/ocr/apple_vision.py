"""OCR con el framework Vision de Apple (gratis, ya viene en macOS). Compila un binario Swift la primera vez."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from ..config import CACHE_DIR

SWIFT_SRC = r'''
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1, let img = NSImage(contentsOfFile: args[1]),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("cannot load image\n".data(using: .utf8)!)
    exit(1)
}
let request = VNRecognizeTextRequest { req, err in
    guard let results = req.results as? [VNRecognizedTextObservation] else { return }
    // ordenar por posición: arriba→abajo, izquierda→derecha
    let sorted = results.sorted {
        let a = $0.boundingBox, b = $1.boundingBox
        if abs(a.midY - b.midY) > 0.02 { return a.midY > b.midY }
        return a.minX < b.minX
    }
    for r in sorted {
        if let c = r.topCandidates(1).first { print(c.string) }
    }
}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["es-MX", "es", "en"]
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try? handler.perform([request])
'''

BIN = CACHE_DIR / "applevision-ocr"


def _ensure_binary() -> Path:
    if BIN.exists():
        return BIN
    if sys.platform != "darwin":
        raise RuntimeError("Apple Vision solo en macOS")
    src = CACHE_DIR / "applevision-ocr.swift"
    src.write_text(SWIFT_SRC)
    subprocess.run(["swiftc", "-O", "-o", str(BIN), str(src)], check=True, capture_output=True)
    return BIN


def ocr(image_path: Path) -> str:
    binary = _ensure_binary()
    out = subprocess.run([str(binary), str(image_path)], capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "apple vision failed")
    return out.stdout
