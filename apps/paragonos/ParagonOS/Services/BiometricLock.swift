import LocalAuthentication
import SwiftUI

@MainActor
final class BiometricLock: ObservableObject {
    @Published var isLocked = false
    @Published var isAuthenticating = false
    @Published var errorMessage: String?

    var biometryTitle: String {
        switch biometry {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "kod urządzenia"
        }
    }

    var lockSymbol: String {
        switch biometry {
        case .touchID: return "touchid"
        default: return "faceid"
        }
    }

    private var biometry: LABiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
        return context.biometryType
    }

    var isAvailable: Bool {
        if isRunningTests { return false }
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    func lockIfNeeded(enabled: Bool) {
        guard enabled, isAvailable, isRunningTests == false else { return }
        isLocked = true
        errorMessage = nil
    }

    func authenticate(enabled: Bool) async -> Bool {
        guard enabled else {
            isLocked = false
            return true
        }
        guard isRunningTests == false else {
            isLocked = false
            return true
        }
        guard isAvailable else {
            errorMessage = "Na tym iPhonie nie ma Face ID, Touch ID ani kodu."
            return false
        }
        guard isAuthenticating == false else { return false }
        isAuthenticating = true
        errorMessage = nil
        defer { isAuthenticating = false }
        let context = LAContext()
        context.localizedCancelTitle = "Anuluj"
        let reason = "Odblokuj \(Brand.displayName), żeby zobaczyć kaucje i paragony."
        do {
            let ok = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
            if ok {
                isLocked = false
                UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            }
            return ok
        } catch {
            errorMessage = error.localizedDescription
            isLocked = true
            return false
        }
    }

    private var isRunningTests: Bool {
        NSClassFromString("XCTestCase") != nil
            || ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }
}

struct LockCoverView: View {
    @ObservedObject var lock: BiometricLock
    var onUnlock: () -> Void

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()
            VStack(spacing: 22) {
                BrandWordmark(size: .title)
                Image(systemName: lock.lockSymbol)
                    .font(.system(size: 44, weight: .medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(ParagonTheme.osGreen)
                Text("ParagonOS™ jest zablokowany")
                    .font(.headline)
                Text("Użyj \(lock.biometryTitle), żeby otworzyć kaucje i paragony.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
                if let message = lock.errorMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
                Button {
                    onUnlock()
                } label: {
                    Label("Odblokuj", systemImage: lock.lockSymbol)
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal, 32)
                .disabled(lock.isAuthenticating)
            }
        }
        .accessibilityAddTraits(.isModal)
    }
}
