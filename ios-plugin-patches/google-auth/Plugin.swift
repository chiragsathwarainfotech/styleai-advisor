import Foundation
import Capacitor
import GoogleSignIn

/**
 * Ported to the modern GoogleSignIn (7.x+) API and pure-Swift Capacitor
 * registration (CAPBridgedPlugin) so it can be linked via Swift Package
 * Manager alongside Firebase (gtm-session-fetcher 5.x).
 */
@objc(GoogleAuth)
public class GoogleAuth: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleAuth"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise)
    ]

    var signInCall: CAPPluginCall!
    var googleSignInConfiguration: GIDConfiguration!
    var forceAuthCode: Bool = false
    var additionalScopes: [String]!

    func loadSignInClient(customClientId: String, customScopes: [String]) {
        let serverClientId = getServerClientIdValue()

        googleSignInConfiguration = GIDConfiguration(clientID: customClientId, serverClientID: serverClientId)
        GIDSignIn.sharedInstance.configuration = googleSignInConfiguration

        // these are scopes granted by default by the signIn method
        let defaultGrantedScopes = ["email", "profile", "openid"]
        // these are scopes we will need to request after sign in
        additionalScopes = customScopes.filter { !defaultGrantedScopes.contains($0) }

        forceAuthCode = getConfig().getBoolean("forceCodeForRefreshToken", false)

        NotificationCenter.default.addObserver(self, selector: #selector(handleOpenUrl(_:)), name: Notification.Name(Notification.Name.capacitorOpenURL.rawValue), object: nil)
    }

    public override func load() {}

    @objc func initialize(_ call: CAPPluginCall) {
        // get client id from initialize, with client id from config file as fallback
        guard let clientId = call.getString("clientId") ?? getClientIdValue() else {
            NSLog("no client id found in config")
            call.resolve()
            return
        }

        // get scopes from initialize, with scopes from config file as fallback
        let customScopes = call.getArray("scopes", String.self) ?? (getConfigValue("scopes") as? [String] ?? [])

        // get force auth code from initialize, with config from config file as fallback
        forceAuthCode = call.getBool("grantOfflineAccess") ?? (getConfigValue("forceCodeForRefreshToken") as? Bool ?? false)

        self.loadSignInClient(customClientId: clientId, customScopes: customScopes)
        call.resolve()
    }

    @objc func signIn(_ call: CAPPluginCall) {
        signInCall = call
        DispatchQueue.main.async {
            if GIDSignIn.sharedInstance.hasPreviousSignIn() && !self.forceAuthCode {
                GIDSignIn.sharedInstance.restorePreviousSignIn { user, error in
                    if let error = error {
                        self.signInCall?.reject(error.localizedDescription)
                        return
                    }
                    if let user = user {
                        self.resolveSignInCallWith(user: user, serverAuthCode: nil)
                    }
                }
            } else {
                guard let presentingVc = self.bridge?.viewController else {
                    self.signInCall?.reject("Unable to get presenting view controller")
                    return
                }
                GIDSignIn.sharedInstance.signIn(withPresenting: presentingVc, hint: nil, additionalScopes: self.additionalScopes) { signInResult, error in
                    if let error = error {
                        self.signInCall?.reject(error.localizedDescription, "\(error._code)")
                        return
                    }
                    guard let result = signInResult else {
                        self.signInCall?.reject("Google sign-in returned no result")
                        return
                    }
                    self.resolveSignInCallWith(user: result.user, serverAuthCode: result.serverAuthCode)
                }
            }
        }
    }

    @objc func refresh(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let currentUser = GIDSignIn.sharedInstance.currentUser else {
                call.reject("User not logged in.")
                return
            }
            currentUser.refreshTokensIfNeeded { user, error in
                guard let user = user else {
                    call.reject(error?.localizedDescription ?? "Something went wrong.")
                    return
                }
                let authenticationData: [String: Any] = [
                    "accessToken": user.accessToken.tokenString,
                    "idToken": user.idToken?.tokenString ?? NSNull(),
                    "refreshToken": user.refreshToken.tokenString
                ]
                call.resolve(authenticationData)
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
        }
        call.resolve()
    }

    @objc func handleOpenUrl(_ notification: Notification) {
        guard let object = notification.object as? [String: Any] else {
            print("There is no object on handleOpenUrl")
            return
        }
        guard let url = object["url"] as? URL else {
            print("There is no url on handleOpenUrl")
            return
        }
        GIDSignIn.sharedInstance.handle(url)
    }

    func getClientIdValue() -> String? {
        if let clientId = getConfig().getString("iosClientId") {
            return clientId
        } else if let clientId = getConfig().getString("clientId") {
            return clientId
        } else if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
                  let dict = NSDictionary(contentsOfFile: path) as? [String: AnyObject],
                  let clientId = dict["CLIENT_ID"] as? String {
            return clientId
        }
        return nil
    }

    func getServerClientIdValue() -> String? {
        return getConfig().getString("serverClientId")
    }

    func resolveSignInCallWith(user: GIDGoogleUser, serverAuthCode: String?) {
        var userData: [String: Any] = [
            "authentication": [
                "accessToken": user.accessToken.tokenString,
                "idToken": user.idToken?.tokenString ?? NSNull(),
                "refreshToken": user.refreshToken.tokenString
            ],
            "serverAuthCode": serverAuthCode ?? NSNull(),
            "email": user.profile?.email ?? NSNull(),
            "familyName": user.profile?.familyName ?? NSNull(),
            "givenName": user.profile?.givenName ?? NSNull(),
            "id": user.userID ?? NSNull(),
            "name": user.profile?.name ?? NSNull()
        ]
        if let imageUrl = user.profile?.imageURL(withDimension: 100)?.absoluteString {
            userData["imageUrl"] = imageUrl
        }
        signInCall?.resolve(userData)
    }
}
