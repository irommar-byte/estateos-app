import ActivityKit
import SwiftUI
import WidgetKit

struct SyncLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SyncActivityAttributes.self) { context in
            lockScreen(context.state)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.finished ? "Gotowe" : "Wysyłanie")
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.percent)%")
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(Color(red: 0.29, green: 0.56, blue: 1))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    detail(context.state)
                }
            } compactLeading: {
                Image(systemName: context.state.finished ? "checkmark.circle.fill" : "arrow.up.circle.fill")
                    .foregroundStyle(context.state.finished ? Color.green : Color(red: 0.29, green: 0.56, blue: 1))
            } compactTrailing: {
                Text(context.state.finished ? "OK" : "\(context.state.percent)%")
                    .font(.caption.weight(.bold).monospacedDigit())
            } minimal: {
                Text("\(context.state.percent)%")
                    .font(.caption2.weight(.bold).monospacedDigit())
            }
        }
    }

    private func lockScreen(_ state: SyncActivityAttributes.ContentState) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(state.finished ? "Wysłane" : "Wysyłanie na \(state.place)")
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text("\(state.percent)%")
                    .font(.title3.weight(.semibold).monospacedDigit())
            }
            ProgressView(value: Double(state.percent), total: 100)
            detail(state)
        }
        .padding(16)
    }

    private func detail(_ state: SyncActivityAttributes.ContentState) -> some View {
        Text(TransferText.summary(
            done: state.done,
            total: state.total,
            bytesLeft: state.finished ? 0 : state.bytesLeft
        ))
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}
