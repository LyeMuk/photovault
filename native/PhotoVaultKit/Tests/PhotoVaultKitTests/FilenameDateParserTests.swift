import Testing
@testable import PhotoVaultKit

@Suite struct FilenameDateParserTests {
    @Test func imgPattern() {
        let result = FilenameDateParser.parse("IMG_20230514_183012.HEIC")
        #expect(result?.year == 2023)
        #expect(result?.month == 5)
        #expect(result?.day == 14)
        #expect(result?.hour == 18)
        #expect(result?.minute == 30)
        #expect(result?.second == 12)
    }

    @Test func pxlPattern() {
        let result = FilenameDateParser.parse("PXL_20230514_183012345.jpg")
        #expect(result?.year == 2023)
        #expect(result?.month == 5)
        #expect(result?.day == 14)
    }

    @Test func screenshotPattern() {
        let result = FilenameDateParser.parse("Screenshot_2023-05-14-18-30-12.png")
        #expect(result?.year == 2023)
        #expect(result?.hour == 18)
    }

    @Test func whatsAppImagePattern() {
        let result = FilenameDateParser.parse("WhatsApp Image 2023-05-14 at 18.30.12.jpeg")
        #expect(result?.year == 2023)
        #expect(result?.day == 14)
        #expect(result?.second == 12)
    }

    @Test func whatsAppVideoDateOnlyPattern() {
        let result = FilenameDateParser.parse("VID-20230514-WA0003.mp4")
        #expect(result?.year == 2023)
        #expect(result?.month == 5)
        #expect(result?.day == 14)
    }

    @Test func unrecognizedFilenameReturnsNil() {
        #expect(FilenameDateParser.parse("random-file-name.jpg") == nil)
    }
}
