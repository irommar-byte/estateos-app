import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

struct ShazamLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ShazamActivityAttributes.self) { context in
            lockScreen(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "shazam.logo")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(EOSLiveColors.accent)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    elapsed(context.state.startedAt)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.message.isEmpty ? phaseLabel(context.state.phase) : context.state.message)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(2)
                        if !context.state.title.isEmpty {
                            Text(context.state.title)
                                .font(.headline)
                                .lineLimit(1)
                            if !context.state.artist.isEmpty {
                                Text(context.state.artist)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        if context.state.phase == .listening || context.state.phase == .preparingActivity {
                            ProgressView()
                                .progressViewStyle(.linear)
                        }
                        if #available(iOS 18.0, *),
                           context.state.phase == .listening || context.state.phase == .preparingActivity {
                            Button(intent: EOSCancelShazamIntent()) {
                                Text("Anuluj")
                            }
                            .tint(EOSLiveColors.accent)
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: "shazam.logo")
                    .foregroundStyle(EOSLiveColors.accent)
            } compactTrailing: {
                elapsed(context.state.startedAt)
            } minimal: {
                Image(systemName: "shazam.logo")
                    .foregroundStyle(EOSLiveColors.accent)
            }
        }
    }

    private func lockScreen(context: ActivityViewContext<ShazamActivityAttributes>) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "shazam.logo")
                .font(.title2.weight(.semibold))
                .foregroundStyle(EOSLiveColors.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text(context.state.message.isEmpty ? phaseLabel(context.state.phase) : context.state.message)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                if !context.state.title.isEmpty {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                    if !context.state.artist.isEmpty {
                        Text(context.state.artist)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                if context.state.phase == .listening || context.state.phase == .preparingActivity {
                    Text(timerInterval: context.state.startedAt...Date.distantFuture, countsDown: false)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            if #available(iOS 18.0, *),
               context.state.phase == .listening || context.state.phase == .preparingActivity {
                Button(intent: EOSCancelShazamIntent()) {
                    Text("Anuluj")
                        .font(.caption.weight(.semibold))
                }
                .tint(EOSLiveColors.accent)
            }
        }
        .padding(16)
        .activityBackgroundTint(Color.black.opacity(0.18))
        .activitySystemActionForegroundColor(.secondary)
    }

    private func elapsed(_ startedAt: Date) -> some View {
        Text(timerInterval: startedAt...Date.distantFuture, countsDown: false)
            .font(.caption.monospacedDigit().weight(.semibold))
            .foregroundStyle(EOSLiveColors.accent)
            .multilineTextAlignment(.trailing)
    }

    private func phaseLabel(_ phase: EOSShazamPhase) -> String {
        switch phase {
        case .preparingActivity, .listening: return "Słucham…"
        case .recognized, .resolvingCatalog, .adding: return "Rozpoznano"
        case .added: return "Dodano do SHAZAM"
        case .alreadyPresent: return "Już jest na liście SHAZAM"
        case .queuedOffline: return "Dodam po odzyskaniu sieci"
        case .failed: return "Nie dodano"
        case .needsSetup: return "Dokończ konfigurację"
        case .idle: return "Shazam"
        }
    }
}
