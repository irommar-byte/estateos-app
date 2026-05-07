//
//  EstateOSRadarWidgetExtensionBundle.swift
//  EstateOSRadarWidgetExtension
//
//  Created by Mariano Italiano on 07/05/2026.
//

import WidgetKit
import SwiftUI

@main
struct EstateOSRadarWidgetExtensionBundle: WidgetBundle {
    var body: some Widget {
        EstateOSRadarWidgetExtension()
        EstateOSRadarWidgetExtensionLiveActivity()
    }
}
