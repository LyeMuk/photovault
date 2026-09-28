import Foundation

/// Extracts a local wall-clock `DateComponents` from common camera/app filename
/// patterns, for `DateCandidates.filenameWallClock` — the fallback used when an
/// asset has neither an EXIF offset nor a PhotoKit `creationDate` (docs/CONTEXT.md
/// §7.2). Every pattern here is a *local* wall clock with no timezone of its own.
public enum FilenameDateParser {
    private struct Pattern {
        let regex: NSRegularExpression
        let groupOrder: [Int] // maps regex capture group index -> [year, month, day, hour, minute, second]
    }

    private static let patterns: [Pattern] = [
        // IMG_20230514_183012, VID_20230514_183012, PXL_20230514_183012345
        makePattern(#"(?:IMG|VID|PXL)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})"#),
        // Screenshot_2023-05-14-18-30-12
        makePattern(#"Screenshot_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})"#),
        // WhatsApp Image 2023-05-14 at 18.30.12 / VID-20230514-WA0003 (date only)
        makePattern(#"WhatsApp (?:Image|Video) (\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})\.(\d{2})"#),
        makePattern(#"(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA\d+"#, groupOrder: [1, 2, 3]),
        // 2023-05-14 18.30.12
        makePattern(#"(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})\.(\d{2})"#),
    ]

    private static func makePattern(_ pattern: String, groupOrder: [Int] = [1, 2, 3, 4, 5, 6]) -> Pattern {
        // swiftlint:disable:next force_try — these are fixed, hand-written patterns covered by tests.
        let regex = try! NSRegularExpression(pattern: pattern)
        return Pattern(regex: regex, groupOrder: groupOrder)
    }

    public static func parse(_ filename: String) -> DateComponents? {
        let range = NSRange(filename.startIndex..<filename.endIndex, in: filename)
        for pattern in patterns {
            guard let match = pattern.regex.firstMatch(in: filename, range: range) else { continue }
            let values = pattern.groupOrder.map { groupIndex -> Int? in
                guard groupIndex < match.numberOfRanges,
                    let r = Range(match.range(at: groupIndex), in: filename)
                else { return nil }
                return Int(filename[r])
            }
            guard let year = values[0], let month = values[1], let day = values[2] else { continue }

            var components = DateComponents()
            components.year = year
            components.month = month
            components.day = day
            if values.count > 3 { components.hour = values[3] ?? 0 }
            if values.count > 4 { components.minute = values[4] ?? 0 }
            if values.count > 5 { components.second = values[5] ?? 0 }
            return components
        }
        return nil
    }
}
