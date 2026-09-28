import Foundation

/// Mirrors `Filter` in apps/web/src/plugins/types.ts §9 — keep both in sync.
/// `FilterCompiler.compile` turns this into parameterized SQL against the `files`
/// table (docs/CONTEXT.md §6.1); nothing here ever touches string concatenation
/// with user data (agent rule, docs/CONTEXT.md §9: "No string concatenation").
public struct Filter: Sendable {
    public enum Scope: String, Sendable { case library, vault, both }

    public struct DateFilter: Sendable {
        public enum Preset: String, Sendable {
            case last30d = "last_30d"
            case last6m = "last_6m"
            case last1y = "last_1y"
            case thisYear = "this_year"
            case lastYear = "last_year"
        }

        public var preset: Preset?
        public var from: Date?
        public var to: Date?
        public var years: [Int]?
        public var months: [Int]?

        public init(preset: Preset? = nil, from: Date? = nil, to: Date? = nil, years: [Int]? = nil, months: [Int]? = nil) {
            self.preset = preset
            self.from = from
            self.to = to
            self.years = years
            self.months = months
        }
    }

    public struct PeopleFilter: Sendable {
        public enum Mode: String, Sendable { case any, all }
        public var ids: [String]
        public var mode: Mode
        public var noFaces: Bool

        public static func matching(ids: [String], mode: Mode) -> PeopleFilter {
            PeopleFilter(ids: ids, mode: mode, noFaces: false)
        }

        public static var withoutFaces: PeopleFilter {
            PeopleFilter(ids: [], mode: .any, noFaces: true)
        }
    }

    public var scope: Scope
    public var kind: [MediaKind]?
    public var date: DateFilter?
    public var countryCodes: [String]?
    public var cities: [String]?
    public var hasGps: Bool?
    public var people: PeopleFilter?
    public var status: [BackupStatus]?
    public var minSizeBytes: Int?
    public var maxSizeBytes: Int?

    public init(
        scope: Scope = .both,
        kind: [MediaKind]? = nil,
        date: DateFilter? = nil,
        countryCodes: [String]? = nil,
        cities: [String]? = nil,
        hasGps: Bool? = nil,
        people: PeopleFilter? = nil,
        status: [BackupStatus]? = nil,
        minSizeBytes: Int? = nil,
        maxSizeBytes: Int? = nil
    ) {
        self.scope = scope
        self.kind = kind
        self.date = date
        self.countryCodes = countryCodes
        self.cities = cities
        self.hasGps = hasGps
        self.people = people
        self.status = status
        self.minSizeBytes = minSizeBytes
        self.maxSizeBytes = maxSizeBytes
    }
}
