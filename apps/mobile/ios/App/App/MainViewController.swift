import Capacitor
import UIKit

/// Registers our own native Capacitor plugins. SceneDelegate.swift instantiates
/// *this* class as the root view controller instead of the plain
/// `CAPBridgeViewController` Capacitor scaffolds by default — both places need to
/// agree (see the comment there; docs/DECISIONS.md 0008 has the story of getting
/// this wrong once). Plugins that ship as npm packages register themselves
/// automatically; plugins that live directly in this app target — like
/// PhotoLibraryPlugin.swift — need to be registered here explicitly.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PhotoLibraryPlugin())
    }
}
