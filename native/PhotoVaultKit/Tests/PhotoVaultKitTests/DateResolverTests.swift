import Testing
@testable import PhotoVaultKit
import Foundation

@Suite struct DateResolverTests {
    @Test func exifOffsetTakesPriorityOverPhotoKitDate() {
        let exifWallClock = DateComponents(year: 2024, month: 6, day: 15, hour: 10, minute: 0, second: 0)
        let candidates = DateCandidates(
            exif: .init(wallClock: exifWallClock, offsetMinutes: 330), // +05:30
            photoKitCreationDate: Date(timeIntervalSince1970: 0) // deliberately wrong, must be ignored
        )

        let resolved = DateResolver.resolve(candidates)

        #expect(resolved.source == .exifOffset)
        #expect(resolved.confidence == .high)
        #expect(resolved.tzOffsetMinutes == 330)
        #expect(resolved.localWallClock.year == 2024)
        #expect(resolved.localWallClock.hour == 10)
    }

    /// docs/CONTEXT.md §14: "31-Dec 23:30 at +05:30" — folder placement and date
    /// filters must use the *local* wall clock (Dec 31), never a UTC-side
    /// recalculation. At +05:30, converting to UTC subtracts the offset (18:00 UTC,
    /// same day here) — the point isn't that UTC rolls over, it's that
    /// `localWallClock` must stay exactly what was captured regardless of what the
    /// UTC math does. (A more negative offset, e.g. US Eastern, is what actually
    /// rolls the UTC calendar day forward — see the sibling case below.)
    @Test func lateDecember31AtPlusFiveThirtyStaysInDecemberLocally() {
        let wallClock = DateComponents(year: 2023, month: 12, day: 31, hour: 23, minute: 30, second: 0)
        let candidates = DateCandidates(exif: .init(wallClock: wallClock, offsetMinutes: 330))

        let resolved = DateResolver.resolve(candidates)

        #expect(resolved.localWallClock.year == 2023)
        #expect(resolved.localWallClock.month == 12)
        #expect(resolved.localWallClock.day == 31)

        let utcComponents = Calendar.utcCalendar.dateComponents([.year, .month, .day, .hour], from: resolved.utc)
        #expect(utcComponents.month == 12)
        #expect(utcComponents.day == 31)
        #expect(utcComponents.hour == 18)
    }

    /// The actual day-rollover case: a negative (west-of-UTC) offset pushes the UTC
    /// instant into the next calendar day, while the local wall clock — what
    /// folder placement and date filters use — correctly stays on Dec 31.
    @Test func lateDecember31AtNegativeOffsetRollsUtcForwardButNotLocal() {
        let wallClock = DateComponents(year: 2023, month: 12, day: 31, hour: 23, minute: 30, second: 0)
        let candidates = DateCandidates(exif: .init(wallClock: wallClock, offsetMinutes: -300)) // US Eastern, -05:00

        let resolved = DateResolver.resolve(candidates)

        #expect(resolved.localWallClock.month == 12)
        #expect(resolved.localWallClock.day == 31)

        let utcComponents = Calendar.utcCalendar.dateComponents([.year, .month, .day], from: resolved.utc)
        #expect(utcComponents.year == 2024)
        #expect(utcComponents.month == 1)
        #expect(utcComponents.day == 1)
    }

    @Test func photoKitDateUsedWhenNoExifOffset() {
        let instant = Calendar.utcCalendar.date(from: DateComponents(year: 2022, month: 3, day: 4, hour: 9))!
        let resolved = DateResolver.resolve(DateCandidates(photoKitCreationDate: instant))

        #expect(resolved.source == .photoKitDate)
        #expect(resolved.confidence == .medium)
        #expect(resolved.tzOffsetMinutes == nil)
        #expect(resolved.localWallClock.year == 2022)
    }

    @Test func filenameFallbackWhenNoExifOrPhotoKitDate() {
        let filenameDate = DateComponents(year: 2021, month: 7, day: 20)
        let resolved = DateResolver.resolve(DateCandidates(filenameWallClock: filenameDate))

        #expect(resolved.source == .filename)
        #expect(resolved.confidence == .medium)
    }

    @Test func fileModificationTimeIsLastResortAndLowConfidence() {
        let mtime = Date(timeIntervalSince1970: 1_600_000_000)
        let resolved = DateResolver.resolve(DateCandidates(fileModificationDate: mtime))

        #expect(resolved.source == .fileModificationTime)
        #expect(resolved.confidence == .low)
        #expect(resolved.utc == mtime)
    }

    @Test func missingEverythingFallsBackWithoutCrashing() {
        let resolved = DateResolver.resolve(DateCandidates())
        #expect(resolved.source == .fileModificationTime)
        #expect(resolved.confidence == .low)
    }
}
