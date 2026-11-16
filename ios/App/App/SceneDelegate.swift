import UIKit
import Capacitor

// iOS 27 terminates apps built with its SDK that don't adopt the UIScene
// lifecycle. The storyboard is loaded through the scene configuration in
// Info.plist; URL and activity callbacks that UIKit now delivers to the scene
// are forwarded to Capacitor so they behave as they did in AppDelegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        (UIApplication.shared.delegate as? AppDelegate)?.window = window

        openURLContexts(connectionOptions.urlContexts)
        connectionOptions.userActivities.forEach(continueActivity)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        openURLContexts(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    private func openURLContexts(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
            options[.sourceApplication] = context.options.sourceApplication
            options[.annotation] = context.options.annotation
            _ = ApplicationDelegateProxy.shared.application(.shared, open: context.url, options: options)
        }
    }

    private func continueActivity(_ userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(.shared, continue: userActivity) { _ in }
    }
}
