import Foundation
import Security

/// docs/CONTEXT.md §6.1: "device_id = a random UUID created at first launch and
/// stored in the Keychain (it survives app reinstall)". Not UserDefaults — that's
/// wiped on uninstall, which would make every reinstall look like a new device to
/// `library_assets`/`asset_files`.
enum DeviceIdentity {
    private static let service = "photovault.device"
    private static let account = "device_id"

    static func stableId() -> String {
        if let existing = read() { return existing }
        let newId = UUID().uuidString
        write(newId)
        return newId
    }

    private static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func write(_ value: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(attributes as CFDictionary, nil)
    }
}
