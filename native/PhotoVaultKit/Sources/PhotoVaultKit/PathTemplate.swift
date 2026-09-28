import Foundation

/// The vault's physical folder layout (docs/CONTEXT.md §5.3): token substitution,
/// filename sanitization for exFAT/FAT32, and the collision-suffix rule. Pure string
/// logic — no filesystem access — so it's fully covered by `swift test`.
public enum PathTemplate {
    public static let defaultTemplate = "PhotoVault/{YYYY}/{MM}-{MonthName}/{original_name}"
    public static let undatedFolder = "PhotoVault/Undated"

    private static let monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    public struct Context {
        /// nil when the asset's capture date is unknown — the caller should route
        /// to `undatedFolder` instead of calling `render`.
        public let year: Int
        public let month: Int // 1...12
        public let day: Int // 1...31
        public let kind: MediaKind
        public let originalFilename: String

        public init(year: Int, month: Int, day: Int, kind: MediaKind, originalFilename: String) {
            self.year = year
            self.month = month
            self.day = day
            self.kind = kind
            self.originalFilename = originalFilename
        }
    }

    /// Renders `template` against `context`. The caller is responsible for
    /// sanitizing `context.originalFilename` first (see `sanitizeFilename`) and for
    /// appending a collision suffix if the target path is already taken by
    /// different content (see `applyCollisionSuffix`).
    public static func render(template: String = defaultTemplate, context: Context) -> String {
        let monthName = (1...12).contains(context.month) ? monthNames[context.month - 1] : "Unknown"
        return template
            .replacingOccurrences(of: "{YYYY}", with: String(format: "%04d", context.year))
            .replacingOccurrences(of: "{MM}", with: String(format: "%02d", context.month))
            .replacingOccurrences(of: "{DD}", with: String(format: "%02d", context.day))
            .replacingOccurrences(of: "{MonthName}", with: monthName)
            .replacingOccurrences(of: "{Kind}", with: context.kind.rawValue)
            .replacingOccurrences(of: "{original_name}", with: context.originalFilename)
    }

    /// docs/CONTEXT.md §5.3: strip forbidden characters and control characters,
    /// trim trailing dots/spaces (both illegal as the last character of an exFAT/
    /// FAT32 component), NFC-normalize, and cap each path component's length.
    public static func sanitizeFilename(_ name: String, maxComponentBytes: Int = 255) -> String {
        let forbidden = CharacterSet(charactersIn: "<>:\"/\\|?*")
        let scalars = name.unicodeScalars.filter { scalar in
            !forbidden.contains(scalar) && !CharacterSet.controlCharacters.contains(scalar)
        }
        var sanitized = String(String.UnicodeScalarView(scalars))
        sanitized = sanitized.precomposedStringWithCanonicalMapping // NFC

        while sanitized.hasSuffix(".") || sanitized.hasSuffix(" ") {
            sanitized.removeLast()
        }
        if sanitized.isEmpty { sanitized = "untitled" }

        while sanitized.utf8.count > maxComponentBytes {
            sanitized.removeLast()
        }
        return sanitized
    }

    /// docs/CONTEXT.md §5.3: "same name, different content: append `_{first 8 hex
    /// chars of sha256}` before the extension."
    public static func applyCollisionSuffix(to filename: String, sha256Hex: String) -> String {
        let suffix = String(sha256Hex.prefix(8))
        let url = URL(fileURLWithPath: filename)
        let ext = url.pathExtension
        let stem = url.deletingPathExtension().lastPathComponent
        return ext.isEmpty ? "\(stem)_\(suffix)" : "\(stem)_\(suffix).\(ext)"
    }
}
