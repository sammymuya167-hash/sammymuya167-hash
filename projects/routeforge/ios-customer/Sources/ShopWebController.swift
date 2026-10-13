import UIKit
import WebKit
import SwiftUI

@MainActor private final class WeakBridge: NSObject, WKScriptMessageHandler {
    weak var owner: ShopWebController?
    init(_ owner: ShopWebController) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.receive(message)
    }
}

@MainActor final class ShopWebController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    let webView: WKWebView
    private let client: CustomerClient
    private let offline = UIStackView()
    private let activity = UIActivityIndicatorView(style: .medium)
    private let failureLabel = UILabel()
    private var loaded = false

    init(client: CustomerClient) {
        self.client = client
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.applicationNameForUserAgent = "RouteForgeCustomeriOS/" + ShopOrigin.version
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = nil
        configuration.userContentController.add(WeakBridge(self), name: "routeforgeCustomer")
        configuration.userContentController.addUserScript(WKUserScript(source: Self.bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
    required init?(coder: NSCoder) { fatalError("Use init(client:)") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.98, green: 0.984, blue: 0.973, alpha: 1)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.accessibilityIdentifier = "shopWebView"
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor), webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        offline.axis = .vertical; offline.alignment = .center; offline.spacing = 18
        offline.translatesAutoresizingMaskIntoConstraints = false
        let title = UILabel(); title.text = "RouteForge Shop"; title.font = .preferredFont(forTextStyle: .title1)
        failureLabel.text = "Connecting to your local shops…"; failureLabel.numberOfLines = 0
        failureLabel.textAlignment = .center; failureLabel.font = .preferredFont(forTextStyle: .body)
        failureLabel.accessibilityIdentifier = "connectionMessage"
        let retry = UIButton(type: .system); retry.setTitle("Try again", for: .normal)
        retry.accessibilityIdentifier = "retryShop"; retry.addTarget(self, action: #selector(retryLoad), for: .touchUpInside)
        for item in [title, failureLabel, activity, retry] { offline.addArrangedSubview(item) }
        view.addSubview(offline)
        NSLayoutConstraint.activate([
            offline.centerXAnchor.constraint(equalTo: view.centerXAnchor), offline.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            offline.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            offline.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24)
        ])
        activity.startAnimating()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--offline-ui-test") { showFailure(); return }
        #endif
        loadShop()
    }

    func loadShop(path: String = "/shop") {
        guard let url = URL(string: path, relativeTo: ShopOrigin.base)?.absoluteURL, ShopOrigin.isShopPage(url) else { return }
        loaded = false; offline.isHidden = false; activity.startAnimating()
        failureLabel.text = "Connecting to your local shops…"
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }
    @objc private func retryLoad() { loadShop() }
    private func showFailure() {
        activity.stopAnimating(); offline.isHidden = false
        failureLabel.text = "You're offline or the shop could not be reached. Your saved basket stays on this device. Reconnect to place an order."
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView.url.map(ShopOrigin.isShopPage) == true else { showFailure(); return }
        loaded = true; activity.stopAnimating(); offline.isHidden = true
        Task { await client.refresh() }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showFailure() }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showFailure() }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == false { decisionHandler(.cancel); return }
        if ShopOrigin.isShopPage(url) { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated, ShopOrigin.isExternalLink(url) { UIApplication.shared.open(url) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let ok = navigationResponse.response.url.map(ShopOrigin.isShopPage) == true
            && ((navigationResponse.response as? HTTPURLResponse)?.statusCode ?? 500) < 400
        decisionHandler(ok ? .allow : .cancel)
        if !ok { showFailure() }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, navigationAction.navigationType == .linkActivated,
           ShopOrigin.isExternalLink(url) { UIApplication.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "RouteForge", message: String(message.prefix(800)), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
    func receive(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
              ShopOrigin.isShopPage(url), let action = message.body as? String else { return }
        switch action {
        case "enableAlerts": Task { await client.enableAlerts() }
        case "sessionChanged": client.sessionChanged(); Task { await client.refresh() }
        default: break
        }
    }
    static let bridgeScript = """
    (() => {
      if (location.origin !== 'https://routeforge-shadownet.sammymuya167.chatgpt.site') return;
      const send = action => window.webkit.messageHandlers.routeforgeCustomer.postMessage(action);
      window.RouteForgeCustomer = Object.freeze({enableAlerts: () => send('enableAlerts')});
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const result = await original(...args);
        try {
          const url = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href);
          if (url.origin === location.origin && result.ok &&
              ['/api/customer/login', '/api/customer/register', '/api/customer/logout', '/api/customer/delete-account'].includes(url.pathname)) send('sessionChanged');
        } catch (_) {}
        return result;
      };
    })();
    """
}

struct ShopWebView: UIViewControllerRepresentable {
    let controller: ShopWebController
    func makeUIViewController(context: Context) -> ShopWebController { controller }
    func updateUIViewController(_ uiViewController: ShopWebController, context: Context) {}
}
