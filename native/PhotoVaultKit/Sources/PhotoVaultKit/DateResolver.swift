import Foundation

/// A UTC-anchored Gregorian calendar, used everywhere DateComponents <-> Date is
/// converted in this file so results never depend on the host machine's local
/// timezone — the same test must pass identically on any CI runner regardless of TZ.
public extension Calendar {
    static var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }
}

/// The raw, per-source signals date resolution chooses between. Callers (the
/// PhotoKit/ImageIO-backed metadata layer, Phase 1+) fill in whichever of these
/// they were able to read; `DateResolver.resolve` never touches PhotoKit or the
/// filesystem itself, which is what keeps it testable with plain `swift test`.
public struct DateCandidates: Sendable {
    public struct ExifCandidate: Sendable {
        /// Year/month/day/hour/minute/second as EXIF `DateTimeOriginal` gives
        /// them — a local wall clock with no timezone of its own.
        public let wallClock: DateComponents
        /// Minutes east of UTC, from EXIF `OffsetTimeOriginal`, when present.
        public let offsetMinutes: Int?

        public init(wallClock: DateComponents, offsetMinutes: Int?) {
            self.wallClock = wallClock
            self.offsetMinutes = offsetMinutes
        }
    }

    public var exif: ExifCandidate?
    public var photoKitCreationDate: Date?
    public var filenameWallClock: DateComponents?
    public var fileModificationDate: Date?

    public init(
        exif: ExifCandidate? = nil,
        photoKitCreationDate: Date? = nil,
        filenameWallClock: DateComponents? = nil,
        fileModificationDate: Date? = nil
    ) {
        self.exif = exif
        self.photoKitCreationDate = photoKitCreationDate
        self.filenameWallClock = filenameWallClock
        self.fileModificationDate = fileModificationDate
    }
}

public struct ResolvedDate: Equatable, Sendable {
    public let utc: Date
    /// The wall-clock date/time PhotoVaultKit treats as authoritative for folder
    /// placement and every date filter (docs/CONTEXT.md §7.2's local-time rule: a
    /// photo taken at 23:30 local on 31 Dec belongs to December, never `utc`).
    public let localWallClock: DateComponents
    public let tzOffsetMinutes: Int?
    public let source: DateSource
    public let confidence: DateConfidence
}

public enum DateResolver {
    /// docs/CONTEXT.md §7.2's capture-date rule, adapted to PhotoVaultKit's actual
    /// sources: unlike the ExifTool-based desktop spec this replaced, PhotoKit
    /// supplies a reliable `creationDate` directly, so there's no multi-tag EXIF/
    /// XMP/QuickTime scan — only EXIF's *offset* is worth reading, as the one
    /// source precise enough to also pin down `tzOffsetMinutes`.
    ///
    /// Priority: EXIF wall-clock+offset (high confidence, known offset) >
    /// PhotoKit creationDate (medium, offset unknown — Phase 3's geocoder can
    /// derive a real offset from GPS + date; until then this is an honest
    /// placeholder, never asserted as verified) > filename pattern (medium/low) >
    /// file modification time (low, last resort).
    public static func resolve(_ candidates: DateCandidates, calendar: Calendar = .utcCalendar) -> ResolvedDate {
        if let exif = candidates.exif, let wallClockUTC = calendar.date(from: exif.wallClock) {
            let offsetSeconds = TimeInterval((exif.offsetMinutes ?? 0) * 60)
            return ResolvedDate(
                utc: wallClockUTC.addingTimeInterval(-offsetSeconds),
                localWallClock: exif.wallClock,
                tzOffsetMinutes: exif.offsetMinutes,
                source: .exifOffset,
                confidence: .high
            )
        }

        if let photoKitDate = candidates.photoKitCreationDate {
            return ResolvedDate(
                utc: photoKitDate,
                localWallClock: wallClockComponents(of: photoKitDate, calendar: calendar),
                tzOffsetMinutes: nil,
                source: .photoKitDate,
                confidence: .medium
            )
        }

        if let filenameWallClock = candidates.filenameWallClock,
            let utc = calendar.date(from: filenameWallClock)
        {
            return ResolvedDate(
                utc: utc,
                localWallClock: filenameWallClock,
                tzOffsetMinutes: nil,
                source: .filename,
                confidence: .medium
            )
        }

        let fallback = candidates.fileModificationDate ?? Date(timeIntervalSince1970: 0)
        return ResolvedDate(
            utc: fallback,
            localWallClock: wallClockComponents(of: fallback, calendar: calendar),
            tzOffsetMinutes: nil,
            source: .fileModificationTime,
            confidence: .low
        )
    }

    private static func wallClockComponents(of date: Date, calendar: Calendar) -> DateComponents {
        calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
    }
}
