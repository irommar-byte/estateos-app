import ActivityKit
import SwiftUI
import WidgetKit

struct DownloadLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DownloadAttributes.self) { context in
            lockScreenBanner(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    phasePill(context.state.phase, finished: context.state.isFinished)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 1) {
                        if context.state.isFinished {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(Color(uiColor: .systemGreen))
                                .symbolRenderingMode(.hierarchical)
                        } else {
                            Text("\(context.state.percentInt)%")
                                .font(.title3.weight(.semibold).monospacedDigit())
                                .foregroundStyle(EOSLiveColors.accent)
                                .contentTransition(.numericText())
                            etaLabel(state: context.state)
                                .font(.caption2)
                        }
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    queueBody(state: context.state, compact: true)
                        .padding(.horizontal, 4)
                }
            }
            compactLeading: {
                if context.state.isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color(uiColor: .systemGreen))
                        .symbolRenderingMode(.hierarchical)
                } else {
                    LiveRing(progress: context.state.clampedOverall)
                        .frame(width: 20, height: 20)
                }
            } compactTrailing: {
                if context.state.isFinished {
                    Image(systemName: "checkmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color(uiColor: .systemGreen))
                } else {
                    Text("\(context.state.percentInt)%")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(EOSLiveColors.accent)
                        .contentTransition(.numericText())
                }
            } minimal: {
                if context.state.isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color(uiColor: .systemGreen))
                        .symbolRenderingMode(.hierarchical)
                } else {
                    LiveRing(progress: context.state.clampedOverall)
                        .frame(width: 18, height: 18)
                }
            }
        }
    }

    private func lockScreenBanner(context: ActivityViewContext<DownloadAttributes>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                phasePill(context.state.phase, finished: context.state.isFinished)
                Spacer(minLength: 8)
                if context.state.isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Color(uiColor: .systemGreen))
                        .symbolRenderingMode(.hierarchical)
                } else {
                    Text("\(context.state.percentInt)%")
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .foregroundStyle(EOSLiveColors.accent)
                        .contentTransition(.numericText())
                    etaLabel(state: context.state)
                }
            }
            queueBody(state: context.state, compact: false)
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
        }
        .activityBackgroundTint(Color.black.opacity(0.18))
        .activitySystemActionForegroundColor(.secondary)
    }

    private func queueBody(state: DownloadAttributes.ContentState, compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 6 : 8) {
            if state.isFinished {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color(uiColor: .systemGreen))
                        .symbolRenderingMode(.hierarchical)
                    Text("Zakończono")
                        .font(.subheadline.weight(.semibold))
                    Spacer(minLength: 0)
                    Text("\(state.completed) z \(max(state.total, 1))")
                        .font(.caption2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            } else {
                LiveCapsuleBar(progress: state.clampedOverall, height: compact ? 6 : 7)
                Text("\(state.completed) z \(max(state.total, 1))")
                    .font(.caption2.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.secondary)

                ForEach(Array(state.currentItems.prefix(3).enumerated()), id: \.offset) { _, item in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 8) {
                            Text(item.title)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                                .truncationMode(.tail)
                            Spacer(minLength: 6)
                            Text("\(Int((min(1, max(0, item.progress)) * 100).rounded()))%")
                                .font(.caption.monospacedDigit().weight(.semibold))
                                .foregroundStyle(EOSLiveColors.accent)
                                .contentTransition(.numericText())
                        }
                        LiveCapsuleBar(progress: min(1, max(0, item.progress)), height: 3.5)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func etaLabel(state: DownloadAttributes.ContentState) -> some View {
        let remaining = max(0, state.total - state.completed)
        Text(DownloadETAFormatter.expanded(LiveActivityLockScreenPolicy.displayETA(
            seconds: state.secondsRemaining,
            remainingCount: remaining
        )))
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }

    private func phasePill(_ phase: String, finished: Bool = false) -> some View {
        let phone = phase.localizedCaseInsensitiveContains("iPhone")
        let done = finished || phase.localizedCaseInsensitiveContains("Zakończ")
        let label = done ? "Zakończono" : (phone ? "iPhone" : "Serwer")
        return HStack(spacing: 5) {
            Image(systemName: done ? "checkmark.circle.fill" : (phone ? "iphone" : "externaldrive.fill"))
                .font(.caption2.weight(.semibold))
            Text(label)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
        }
        .foregroundStyle(done ? Color(uiColor: .systemGreen) : EOSLiveColors.accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background((done ? Color(uiColor: .systemGreen) : EOSLiveColors.accent).opacity(0.14), in: Capsule())
    }
}

private struct LiveCapsuleBar: View {
    var progress: Double
    var height: CGFloat

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.primary.opacity(0.10))
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [EOSLiveColors.accent, EOSLiveColors.accentSecondary],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(height, geo.size.width * CGFloat(min(1, max(0.02, progress)))))
            }
        }
        .frame(height: height)
        .animation(.easeOut(duration: 0.22), value: progress)
    }
}

private struct LiveRing: View {
    var progress: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.primary.opacity(0.14), lineWidth: 2.2)
            Circle()
                .trim(from: 0, to: min(1, max(0.04, progress)))
                .stroke(
                    AngularGradient(
                        colors: [EOSLiveColors.accent, EOSLiveColors.accentSecondary, EOSLiveColors.accent],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
        }
    }
}
