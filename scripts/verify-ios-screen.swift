import Foundation
import Vision
import ImageIO

// A launched process is insufficient: require visible app text in the simulator.
guard CommandLine.arguments.count == 2,
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { exit(2) }
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["es-ES", "en-US"]
do {
    try VNImageRequestHandler(cgImage: image).perform([request])
    let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: " ")
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es_MX"))
    guard text.contains("tehilim"), text.contains("iniciar sesion"), text.contains("crear cuenta") else { exit(1) }
    print("PASS: Tehilim title, sign-in and account controls are visible in iPhone simulator")
} catch { exit(2) }
