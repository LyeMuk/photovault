import Photos
import UIKit
import WebKit

/// Serves `pv-thumb://asset?id=<PHAsset.localIdentifier>&s=<size>` — the custom
/// scheme apps/web/src/plugins/thumbnailUrl.ts builds on-device instead of ever
/// passing image bytes across the Capacitor bridge (docs/CONTEXT.md §4.2/D3: "Never
/// pass photo bytes or base64 across the bridge — the bridge is slow; base64 of
/// videos would crash the WebView"). Registered on the WKWebView's configuration in
/// MainViewController.webViewConfiguration(for:).
class PVThumbSchemeHandler: NSObject, WKURLSchemeHandler {
    private let imageManager = PHCachingImageManager()

    // WKURLSchemeTask instances get invalidated once `stop` is called (e.g. the
    // WebView navigated away mid-request); calling didReceive/didFinish on a
    // stopped task crashes. Track cancellation ourselves since PHImageManager's
    // completion handler has no idea the task was stopped.
    private var cancelled = Set<ObjectIdentifier>()
    private let lock = NSLock()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard
            let url = urlSchemeTask.request.url,
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let assetId = components.queryItems?.first(where: { $0.name == "id" })?.value,
            let asset = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil).firstObject
        else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        let size = Int(components.queryItems?.first(where: { $0.name == "s" })?.value ?? "") ?? 256
        let targetSize = CGSize(width: size, height: size)
        let taskId = ObjectIdentifier(urlSchemeTask)

        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = false
        options.isSynchronous = false

        imageManager.requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: options) { [weak self] image, _ in
            guard let self else { return }
            self.lock.lock()
            let wasCancelled = self.cancelled.contains(taskId)
            self.lock.unlock()
            guard !wasCancelled else { return }

            guard let image, let data = image.jpegData(compressionQuality: 0.8) else {
                urlSchemeTask.didFailWithError(URLError(.cannotDecodeContentData))
                return
            }
            let response = URLResponse(url: url, mimeType: "image/jpeg", expectedContentLength: data.count, textEncodingName: nil)
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock()
        cancelled.insert(ObjectIdentifier(urlSchemeTask))
        lock.unlock()
    }
}
