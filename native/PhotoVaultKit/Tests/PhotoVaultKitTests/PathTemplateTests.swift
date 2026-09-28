import Testing
@testable import PhotoVaultKit

@Suite struct PathTemplateTests {
    @Test func defaultTemplateRendersYearMonthNameDayAndFilename() {
        let context = PathTemplate.Context(year: 2024, month: 5, day: 14, kind: .photo, originalFilename: "IMG_1234.HEIC")
        let path = PathTemplate.render(context: context)
        #expect(path == "PhotoVault/2024/05-May/IMG_1234.HEIC")
    }

    @Test func zeroPadsSingleDigitMonthAndDay() {
        let context = PathTemplate.Context(year: 2024, month: 1, day: 3, kind: .photo, originalFilename: "a.jpg")
        let path = PathTemplate.render(context: context)
        #expect(path.contains("/2024/01-January/"))
    }

    @Test func sanitizeStripsForbiddenAndControlCharacters() {
        #expect(PathTemplate.sanitizeFilename("a<b>c:d\"e/f\\g|h?i*j.jpg") == "abcdefghij.jpg")
    }

    @Test func sanitizeTrimsTrailingDotsAndSpaces() {
        #expect(PathTemplate.sanitizeFilename("photo.  ") == "photo")
    }

    @Test func sanitizeNormalizesToNFC() {
        // "é" as e + combining acute accent (NFD) must normalize to the single
        // precomposed NFC code point.
        let nfd = "e\u{0301}.jpg"
        let sanitized = PathTemplate.sanitizeFilename(nfd)
        #expect(sanitized == "é.jpg")
        #expect(sanitized.unicodeScalars.count == 5) // é . j p g — one scalar for é, not two
    }

    @Test func sanitizeCapsComponentLength() {
        let long = String(repeating: "a", count: 500) + ".jpg"
        let sanitized = PathTemplate.sanitizeFilename(long, maxComponentBytes: 20)
        #expect(sanitized.utf8.count <= 20)
    }

    @Test func sanitizeNeverReturnsEmptyString() {
        #expect(PathTemplate.sanitizeFilename("...") == "untitled")
    }

    @Test func collisionSuffixInsertedBeforeExtension() {
        let result = PathTemplate.applyCollisionSuffix(to: "IMG_0001.HEIC", sha256Hex: "3fa9c2d1abcdef0123456789")
        #expect(result == "IMG_0001_3fa9c2d1.HEIC")
    }

    @Test func collisionSuffixWithNoExtension() {
        let result = PathTemplate.applyCollisionSuffix(to: "IMG_0001", sha256Hex: "3fa9c2d1abcdef")
        #expect(result == "IMG_0001_3fa9c2d1")
    }
}
