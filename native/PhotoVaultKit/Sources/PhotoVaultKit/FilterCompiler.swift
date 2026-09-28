import Foundation
import GRDB

/// Compiles `Filter` into parameterized SQL against the `v_assets` view (defined in
/// migration `v1`, see IndexStore/Migrations.swift), which unifies `library_assets`
/// and `files` the way the TS layer's flat `AssetSummary` does. docs/CONTEXT.md §9:
/// "It compiles to parameterized SQL in Swift. No string concatenation." — every
/// value here goes through GRDB's `arguments`, never interpolated into the SQL text.
public enum FilterCompiler {
    public struct Compiled {
        public let whereClause: String
        public let arguments: StatementArguments
    }

    public static func compile(_ filter: Filter, now: Date = Date()) -> Compiled {
        var clauses: [String] = []
        var arguments: [DatabaseValueConvertible?] = []

        if let kinds = filter.kind, !kinds.isEmpty {
            var kindClauses: [String] = []
            for kind in kinds {
                switch kind {
                case .photo, .video:
                    kindClauses.append("kind = ?")
                    arguments.append(kind.rawValue)
                case .favorite:
                    kindClauses.append("is_favorite = 1")
                case .screenshot:
                    kindClauses.append("is_screenshot = 1")
                case .edited:
                    kindClauses.append("role = 'edited'")
                case .live:
                    kindClauses.append(
                        "(role = 'original' AND EXISTS (SELECT 1 FROM files sib WHERE sib.group_id = v_assets.group_id AND sib.role = 'live_motion'))"
                    )
                }
            }
            clauses.append("(" + kindClauses.joined(separator: " OR ") + ")")
        }

        if let statuses = filter.status, !statuses.isEmpty {
            clauses.append("status IN (" + statuses.map { _ in "?" }.joined(separator: ",") + ")")
            arguments.append(contentsOf: statuses.map { $0.rawValue })
        }

        if let date = filter.date {
            let resolved = resolveDateBounds(date, now: now)
            if let from = resolved.from {
                clauses.append("captured_at_local >= ?")
                arguments.append(from)
            }
            if let to = resolved.to {
                clauses.append("captured_at_local <= ?")
                arguments.append(to)
            }
            if let years = date.years, !years.isEmpty {
                clauses.append("CAST(strftime('%Y', captured_at_local) AS INTEGER) IN (" + years.map { _ in "?" }.joined(separator: ",") + ")")
                arguments.append(contentsOf: years)
            }
            if let months = date.months, !months.isEmpty {
                clauses.append("CAST(strftime('%m', captured_at_local) AS INTEGER) IN (" + months.map { _ in "?" }.joined(separator: ",") + ")")
                arguments.append(contentsOf: months)
            }
        }

        if let countryCodes = filter.countryCodes, !countryCodes.isEmpty {
            clauses.append("country_code IN (" + countryCodes.map { _ in "?" }.joined(separator: ",") + ")")
            arguments.append(contentsOf: countryCodes)
        }
        if let cities = filter.cities, !cities.isEmpty {
            clauses.append("city IN (" + cities.map { _ in "?" }.joined(separator: ",") + ")")
            arguments.append(contentsOf: cities)
        }
        if let hasGps = filter.hasGps {
            clauses.append(hasGps ? "lat IS NOT NULL" : "lat IS NULL")
        }

        if let people = filter.people {
            if people.noFaces {
                clauses.append("NOT EXISTS (SELECT 1 FROM faces WHERE faces.file_id = v_assets.file_id)")
            } else if !people.ids.isEmpty {
                let placeholders = people.ids.map { _ in "?" }.joined(separator: ",")
                switch people.mode {
                case .any:
                    clauses.append(
                        """
                        EXISTS (
                          SELECT 1 FROM faces
                          JOIN face_clusters ON face_clusters.id = faces.cluster_id
                          WHERE faces.file_id = v_assets.file_id AND face_clusters.person_id IN (\(placeholders))
                        )
                        """
                    )
                    arguments.append(contentsOf: people.ids)
                case .all:
                    clauses.append(
                        """
                        (
                          SELECT COUNT(DISTINCT face_clusters.person_id) FROM faces
                          JOIN face_clusters ON face_clusters.id = faces.cluster_id
                          WHERE faces.file_id = v_assets.file_id AND face_clusters.person_id IN (\(placeholders))
                        ) = ?
                        """
                    )
                    arguments.append(contentsOf: people.ids)
                    arguments.append(people.ids.count)
                }
            }
        }

        if let minBytes = filter.minSizeBytes {
            clauses.append("size_bytes >= ?")
            arguments.append(minBytes)
        }
        if let maxBytes = filter.maxSizeBytes {
            clauses.append("size_bytes <= ?")
            arguments.append(maxBytes)
        }

        let whereClause = clauses.isEmpty ? "1=1" : clauses.joined(separator: " AND ")
        return Compiled(whereClause: whereClause, arguments: StatementArguments(arguments))
    }

    private static func resolveDateBounds(_ date: Filter.DateFilter, now: Date) -> (from: String?, to: String?) {
        let iso = ISO8601DateFormatter()
        var from: String?
        var to: String?
        if let f = date.from { from = iso.string(from: f) }
        if let t = date.to { to = iso.string(from: t) }

        guard let preset = date.preset else { return (from, to) }
        let calendar = Calendar.utcCalendar
        switch preset {
        case .last30d:
            from = iso.string(from: calendar.date(byAdding: .day, value: -30, to: now)!)
        case .last6m:
            from = iso.string(from: calendar.date(byAdding: .month, value: -6, to: now)!)
        case .last1y:
            from = iso.string(from: calendar.date(byAdding: .year, value: -1, to: now)!)
        case .thisYear:
            let year = calendar.component(.year, from: now)
            from = iso.string(from: calendar.date(from: DateComponents(year: year, month: 1, day: 1))!)
            to = iso.string(from: calendar.date(from: DateComponents(year: year, month: 12, day: 31, hour: 23, minute: 59, second: 59))!)
        case .lastYear:
            let year = calendar.component(.year, from: now) - 1
            from = iso.string(from: calendar.date(from: DateComponents(year: year, month: 1, day: 1))!)
            to = iso.string(from: calendar.date(from: DateComponents(year: year, month: 12, day: 31, hour: 23, minute: 59, second: 59))!)
        }
        return (from, to)
    }
}
