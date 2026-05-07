import ActivityKit
import WidgetKit
import SwiftUI

struct RadarLiveActivityAttributes: ActivityAttributes {

  public struct ContentState: Codable, Hashable {
      var transactionType: String
      var city: String
      var minMatchThreshold: Int
      var activeMatchesCount: Int
      var updatedAtIso: String
  }

    var radarName: String
}

struct EstateOSRadarWidgetExtensionLiveActivity: Widget {

    var body: some WidgetConfiguration {

        ActivityConfiguration(
            for: RadarLiveActivityAttributes.self
        ) { context in

            VStack(alignment: .leading, spacing: 8) {

                HStack {

                    Image(systemName: "dot.radiowaves.left.and.right")
                        .foregroundColor(.green)

                    Text("Radar aktywny")
                        .font(.headline)
                        .foregroundColor(.white)
                }

                Text(context.state.city)
                    .font(.title3)
                    .bold()
                    .foregroundColor(.white)

                HStack {

                  Text(context.state.transactionType)

                      .foregroundColor(.green)

                  Spacer()

                  Text("\(context.state.activeMatchesCount) ofert")

                      .foregroundColor(.white)
                }

              Text("Limit: \(context.state.minMatchThreshold) PLN")
                    .font(.caption)
                    .foregroundColor(.gray)

            }
            .padding()
            .activityBackgroundTint(.black)
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in

            DynamicIsland {

                DynamicIslandExpandedRegion(.leading) {

                    Image(systemName: "dot.radiowaves.left.and.right")
                        .foregroundColor(.green)
                }

                DynamicIslandExpandedRegion(.trailing) {

                  Text("\(context.state.activeMatchesCount)")
                        .bold()
                        .foregroundColor(.white)
                }

                DynamicIslandExpandedRegion(.bottom) {

                    VStack(alignment: .leading, spacing: 4) {

                        Text(context.state.city)
                            .bold()
                            .foregroundColor(.white)

                      Text(context.state.transactionType)
                            .foregroundColor(.green)

                      Text("Limit \(context.state.minMatchThreshold) PLN")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }

            } compactLeading: {

                Image(systemName: "dot.radiowaves.left.and.right")
                    .foregroundColor(.green)

            } compactTrailing: {

              Text("\(context.state.activeMatchesCount)")
                    .foregroundColor(.white)

            } minimal: {

                Image(systemName: "dot.radiowaves.left.and.right")
                    .foregroundColor(.green)
            }
            .keylineTint(.green)
        }
    }
}
