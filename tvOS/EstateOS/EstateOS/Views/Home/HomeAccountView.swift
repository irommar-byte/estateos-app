import SwiftUI

// MARK: - Konto (2026-10)
//
// Two columns, like Settings on Apple TV — but with a membership card that makes the plan
// obvious at a glance. Left: who you are and your plan (Pro gets the gold card, a moving sheen
// and the PRO mark in the header capsule). Right: everything you can switch, grouped:
// Intelligence, look and start screen, privacy, account management, about.
// Things a TV can't do well (payments, editing the profile) open on the iPhone through a QR code.

struct HomeAccountView: View {
    @EnvironmentObject private var app: AppModel
    @Binding var claimFocus: Bool
    var onOpenFilters: () -> Void

    @FocusState private var focus: AccountRow?
    @State private var link: AccountLink?
    @State private var confirmLogout = false

    enum AccountRow: Hashable {
        case membership, signIn
        case intelligence
        case appearance(EOSAppearance), startTab(HomeTab), motion, topShelf(TopShelfPresentationStyle)
        case rememberRecents, clearRecents
        case listings, manage, plans, refresh, logout
        case privacy, terms
    }

    var body: some View {
        HStack(alignment: .top, spacing: 56) {
            AccountIdentityColumn(focus: $focus, onUpgrade: { link = .plans }, onManage: { link = .manage })
                .frame(width: 600)
                .focusSection()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 44) {
                    intelligenceGroup
                    lookGroup
                    privacyGroup
                    accountGroup
                    aboutGroup
                }
                .padding(.vertical, 8)
                .padding(.bottom, 80)
            }
            .scrollClipDisabled()
            .focusSection()
        }
        .padding(.top, EOSShellMetrics.contentTopInset + 8)
        .onChange(of: claimFocus) { _, requested in
            guard requested else { return }
            claimFocus = false
            focus = app.session == nil ? .signIn : .membership
        }
        .fullScreenCover(item: $link) { item in
            EOSQrSheet(
                title: item.title,
                subtitle: item.subtitle,
                urlString: item.url,
                footnote: item.footnote,
                eyebrow: "OTWÓRZ NA IPHONIE"
            )
        }
        .confirmationDialog("Wylogować się z EstateOS na tym Apple TV?", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("Wyloguj", role: .destructive) { app.logout() }
            Button("Anuluj", role: .cancel) {}
        }
    }

    // MARK: Intelligence

    private var intelligenceGroup: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 18) {
                EOSIntelligenceOrb(size: 52)
                VStack(alignment: .leading, spacing: 2) {
                    Text("ESTATEOS™ INTELLIGENCE")
                        .font(.system(size: 15, weight: .heavy))
                        .tracking(2.4)
                        .foregroundStyle(.secondary)
                    Text("Rekomendacje dla Ciebie")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(LinearGradient(colors: EOSIntelligence.hot, startPoint: .leading, endPoint: .trailing))
                }
            }
            AccountToggleRow(
                icon: "sparkles",
                tint: EOSIntelligence.violet,
                title: "Rząd „Dla Ciebie”",
                subtitle: app.session == nil
                    ? "Zaloguj się, aby EstateOS uczył się Twojego gustu."
                    : "Uczy się z tego, co oglądasz. Ten sam przełącznik co na iPhonie i estateos.pl.",
                isOn: app.intelligenceActive,
                busy: app.isUpdatingIntelligence
            ) {
                if app.session == nil { app.openLoginSheet() } else {
                    Task { await app.setIntelligence(!app.intelligenceActive) }
                }
            }
            .focused($focus, equals: .intelligence)
        }
    }

    // MARK: Look & start

    private var lookGroup: some View {
        AccountGroup(title: "Wygląd i ekran startowy") {
            AccountOptionStrip(title: "Motyw", note: "Zdjęcia ofert, mapa i galerie zawsze w trybie kinowym") {
                ForEach(EOSAppearance.allCases) { option in
                    AccountOptionTile(icon: option.icon, title: option.title, selected: app.appearance == option) {
                        withAnimation(.easeInOut(duration: 0.4)) { app.appearance = option }
                    }
                    .focused($focus, equals: .appearance(option))
                }
            }
            AccountOptionStrip(title: "Po uruchomieniu", note: nil) {
                ForEach([HomeTab.showroom, .cars, .map], id: \.self) { tab in
                    AccountOptionTile(icon: tab.iconName, title: tab.rawValue, selected: app.startTab == tab) {
                        app.startTab = tab
                    }
                    .focused($focus, equals: .startTab(tab))
                }
            }
            AccountToggleRow(
                icon: "photo.on.rectangle.angled",
                tint: Color(red: 0.36, green: 0.62, blue: 1),
                title: "Ruchome zdjęcia w tle",
                subtitle: "Powolne przybliżanie dużych zdjęć, jak w aplikacji Apple TV.",
                isOn: app.ambientMotion
            ) { app.ambientMotion.toggle() }
            .focused($focus, equals: .motion)
            AccountOptionStrip(title: "Górny pasek Apple TV", note: "Widać go, gdy EstateOS jest w górnym rzędzie ekranu głównego") {
                ForEach(TopShelfPresentationStyle.allCases) { style in
                    AccountOptionTile(
                        icon: style == .carousel ? "rectangle.inset.filled" : "rectangle.split.3x1",
                        title: style == .carousel ? "Pełny ekran" : "Kafelki",
                        selected: app.topShelfStyle == style
                    ) { app.setTopShelfStyle(style) }
                    .focused($focus, equals: .topShelf(style))
                }
            }
        }
    }

    // MARK: Privacy

    private var privacyGroup: some View {
        AccountGroup(title: "Prywatność") {
            AccountToggleRow(
                icon: "clock.arrow.circlepath",
                tint: Color(white: 0.55),
                title: "Zapamiętuj ostatnio oglądane",
                subtitle: "Historia zostaje tylko na tym Apple TV.",
                isOn: app.rememberRecents
            ) { app.rememberRecents.toggle() }
            .focused($focus, equals: .rememberRecents)

            let historyCount = app.recentOfferIds.count + app.recentCarIds.count
            if historyCount > 0 {
                AccountActionRow(icon: "trash", tint: .red, title: "Wyczyść historię oglądania",
                                 value: "\(historyCount)") { app.clearRecents() }
                    .focused($focus, equals: .clearRecents)
            }
        }
    }

    // MARK: Account

    @ViewBuilder
    private var accountGroup: some View {
        AccountGroup(title: "Konto") {
            if app.session != nil {
                let own = app.ownOffers.count
                AccountActionRow(icon: "building.2.fill", tint: Color(red: 0.25, green: 0.78, blue: 0.52),
                                 title: "Twoje ogłoszenia", value: own > 0 ? "\(own)" : nil, chevron: true) { link = .listings }
                    .focused($focus, equals: .listings)
                AccountActionRow(icon: "person.text.rectangle.fill", tint: Color(red: 0.36, green: 0.62, blue: 1),
                                 title: "Profil, e-mail i hasło", value: nil, chevron: true) { link = .manage }
                    .focused($focus, equals: .manage)
                AccountActionRow(icon: "crown.fill", tint: EOSGold.deep,
                                 title: "Plan i płatności", value: app.profile?.tier.title, chevron: true) { link = .plans }
                    .focused($focus, equals: .plans)
            }
            AccountActionRow(icon: "arrow.clockwise", tint: Color(white: 0.55), title: "Odśwież dane", value: nil) {
                Task {
                    try? await app.refreshOffers()
                    try? await app.refreshCars()
                    await app.refreshFavorites()
                    await app.refreshAccount()
                }
            }
            .focused($focus, equals: .refresh)
            if app.session != nil {
                AccountActionRow(icon: "rectangle.portrait.and.arrow.right", tint: .red, title: "Wyloguj", value: nil, destructive: true) {
                    confirmLogout = true
                }
                .focused($focus, equals: .logout)
            }
        }
    }

    // MARK: About

    private var aboutGroup: some View {
        AccountGroup(title: "O aplikacji") {
            HStack(spacing: 40) {
                aboutFact("Wersja", Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")
                aboutFact("Nieruchomości", FilterFormat.grouped(app.offers.count))
                aboutFact("Samochody", FilterFormat.grouped(app.cars.count))
                aboutFact("Serwer", AppConfig.apiBaseURL.host ?? "estateos.pl")
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color.primary.opacity(0.05)))
            HStack(spacing: 20) {
                AccountActionRow(icon: "hand.raised.fill", tint: Color(white: 0.55), title: "Polityka prywatności", value: nil, chevron: true) { link = .privacy }
                    .focused($focus, equals: .privacy)
                AccountActionRow(icon: "doc.text.fill", tint: Color(white: 0.55), title: "Regulamin", value: nil, chevron: true) { link = .terms }
                    .focused($focus, equals: .terms)
            }
        }
    }

    private func aboutFact(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 14, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 24, weight: .semibold))
                .lineLimit(1)
        }
    }
}

// MARK: - Links opened on the iPhone

struct AccountLink: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let url: String
    var footnote: String? = nil

    private static func web(_ path: String) -> String { AppConfig.apiBaseURL.absoluteString + path }

    static let manage = AccountLink(id: "manage", title: "Zarządzaj kontem", subtitle: "Profil, e-mail, telefon, hasło i Passkey",
                                    url: web("/moje-konto"), footnote: "Zmiany zobaczysz tu od razu po odświeżeniu.")
    static let listings = AccountLink(id: "listings", title: "Twoje ogłoszenia", subtitle: "Dodawaj, edytuj i promuj oferty",
                                      url: web("/moje-konto/ogloszenia"))
    static let plans = AccountLink(id: "plans", title: "EstateOS Pro", subtitle: "Plany, płatności i faktury",
                                   url: web("/cennik"), footnote: "Po zakupie Pro odśwież dane w Koncie — złota karta pojawi się od razu.")
    static let privacy = AccountLink(id: "privacy", title: "Polityka prywatności", subtitle: "Jak EstateOS chroni Twoje dane",
                                     url: web("/polityka-prywatnosci"))
    static let terms = AccountLink(id: "terms", title: "Regulamin", subtitle: "Zasady korzystania z EstateOS", url: web("/regulamin"))
}

// MARK: - Identity column

private struct AccountIdentityColumn: View {
    @EnvironmentObject private var app: AppModel
    var focus: FocusState<HomeAccountView.AccountRow?>.Binding
    let onUpgrade: () -> Void
    let onManage: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 34) {
            if app.session == nil {
                signedOut
            } else {
                identity
                MembershipCard(profile: app.profile) {
                    if app.profile?.tier.isPremium == true { onManage() } else { onUpgrade() }
                }
                .focused(focus, equals: .membership)
            }
        }
    }

    private var identity: some View {
        let profile = app.profile
        let premium = profile?.tier.isPremium == true
        return HStack(alignment: .center, spacing: 28) {
            AccountAvatar(profile: profile, fallbackName: app.session?.user.login ?? "", premium: premium)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 14) {
                    Text(profile?.displayName ?? app.session?.user.login ?? "")
                        .font(.system(size: 40, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if premium { EOSProBadge(size: .small) }
                }
                if let email = profile?.email ?? app.session?.user.email {
                    Text(email)
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                HStack(spacing: 10) {
                    if let role = profile?.roleLabel { chip(role, icon: "briefcase.fill") }
                    if let company = profile?.companyName, !company.isEmpty { chip(company, icon: "building.2") }
                }
                HStack(spacing: 10) {
                    if profile?.emailVerified == true { chip("E-mail", icon: "checkmark.seal.fill", tint: .green) }
                    if profile?.phoneVerified == true { chip("Telefon", icon: "checkmark.seal.fill", tint: .green) }
                    if profile?.hasPasskey == true { chip("Passkey", icon: "person.badge.key.fill", tint: .green) }
                }
            }
        }
    }

    private func chip(_ text: String, icon: String, tint: Color = .secondary) -> some View {
        Label(text, systemImage: icon)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(tint == .secondary ? AnyShapeStyle(.secondary) : AnyShapeStyle(tint))
            .lineLimit(1)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule().fill(Color.primary.opacity(0.08)))
    }

    private var signedOut: some View {
        VStack(alignment: .leading, spacing: 24) {
            ZStack {
                Circle().fill(Color.primary.opacity(0.08))
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 76, weight: .light))
                    .foregroundStyle(.secondary)
            }
            .frame(width: 150, height: 150)
            Text("Witaj w EstateOS")
                .font(.system(size: 46, weight: .bold))
            VStack(alignment: .leading, spacing: 14) {
                benefit("heart.fill", .pink, "Ulubione z iPhone’a i estateos.pl")
                benefit("sparkles", EOSIntelligence.violet, "„Dla Ciebie” — oferty dobrane do gustu")
                benefit("building.2.fill", Color(red: 0.25, green: 0.78, blue: 0.52), "Twoje ogłoszenia i ich statystyki")
                benefit("crown.fill", EOSGold.deep, "Status Pro i jego korzyści")
            }
            Button { app.openLoginSheet() } label: {
                Label("Zaloguj się iPhone’em", systemImage: "iphone.gen3")
                    .font(.system(size: 26, weight: .semibold))
                    .padding(.horizontal, 12)
            }
            .eosButton()
            .focused(focus, equals: .signIn)
            .padding(.top, 6)
        }
    }

    private func benefit(_ icon: String, _ tint: Color, _ text: String) -> some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 34)
            Text(text)
                .font(.system(size: 23, weight: .medium))
        }
    }
}

private struct AccountAvatar: View {
    let profile: AccountProfile?
    let fallbackName: String
    let premium: Bool

    var body: some View {
        ZStack {
            Circle().fill(
                LinearGradient(colors: [Color(red: 0.25, green: 0.78, blue: 0.52), Color(red: 0.12, green: 0.42, blue: 0.62)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            Text(profile?.initials ?? String(fallbackName.prefix(1)).uppercased())
                .font(.system(size: 50, weight: .bold))
                .foregroundStyle(.white)
            if let url = EOSOfferMedia.imageURL(from: profile?.image) {
                EOSCachedRemoteImage(url: url, contentMode: .fill, size: .thumb) { Color.clear }
                    .clipShape(Circle())
            }
        }
        .frame(width: 150, height: 150)
        .overlay {
            if premium {
                Circle().strokeBorder(EOSGold.metal, lineWidth: 5).padding(-9)
            }
        }
        .shadow(color: .black.opacity(0.3), radius: 18, y: 10)
        .padding(premium ? 9 : 0)
    }
}

// MARK: - Membership card

/// The plan as a physical card: gold metal for Pro, graphite for Plus / Investor, glass for basic.
private struct MembershipCard: View {
    let profile: AccountProfile?
    let action: () -> Void

    @Environment(\.eosAmbientMotion) private var ambientMotion
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sheen = false

    private var tier: AccountProfile.Tier { profile?.tier ?? .basic }

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topLeading) {
                background
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        EOSWordmark(size: 26)
                            .colorMultiply(tier.isPremium ? Color(red: 0.25, green: 0.17, blue: 0.05) : .white)
                        Spacer()
                        Image(systemName: icon)
                            .font(.system(size: 34, weight: .semibold))
                    }
                    Spacer(minLength: 0)
                    Text(tier == .basic ? "KONTO" : "CZŁONKOSTWO")
                        .font(.system(size: 15, weight: .heavy))
                        .tracking(2.6)
                        .opacity(0.7)
                    Text(tier.title)
                        .font(.system(size: 40, weight: .bold))
                        .tracking(-0.4)
                    Text(subtitle)
                        .font(.system(size: 20, weight: .medium))
                        .opacity(0.8)
                        .lineLimit(2)
                        .padding(.top, 4)
                    HStack(spacing: 8) {
                        Text(callToAction)
                        Image(systemName: "chevron.right")
                    }
                    .font(.system(size: 19, weight: .semibold))
                    .padding(.top, 16)
                    .opacity(0.9)
                }
                .padding(32)
                .foregroundStyle(foreground)
            }
            .frame(width: 600, height: 340)
            .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
            .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 34, style: .continuous))
            .hoverEffect(.highlight)
        }
        .buttonStyle(.borderless)
        .onAppear {
            guard tier.isPremium, ambientMotion, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3.6).repeatForever(autoreverses: false).delay(1.2)) { sheen = true }
        }
        .accessibilityLabel("\(tier.title). \(subtitle)")
    }

    @ViewBuilder
    private var background: some View {
        switch tier {
        case .pro, .agency, .admin:
            ZStack {
                EOSGold.card
                // Brushed-metal grain.
                LinearGradient(colors: [.white.opacity(0.25), .clear, .white.opacity(0.12), .clear],
                               startPoint: .top, endPoint: .bottom)
                    .blendMode(.overlay)
                // Moving sheen across the card.
                GeometryReader { geo in
                    LinearGradient(colors: [.clear, .white.opacity(0.55), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: geo.size.width * 0.35)
                        .rotationEffect(.degrees(18))
                        .offset(x: sheen ? geo.size.width * 1.2 : -geo.size.width * 0.6)
                        .blendMode(.softLight)
                }
            }
        case .plus, .investor:
            LinearGradient(colors: [Color(white: 0.32), Color(white: 0.12), Color(white: 0.24)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .overlay(LinearGradient(colors: [.white.opacity(0.18), .clear], startPoint: .top, endPoint: .center))
        case .basic:
            LinearGradient(colors: [Color(red: 0.12, green: 0.2, blue: 0.18), Color(red: 0.05, green: 0.08, blue: 0.1)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous).strokeBorder(Color.white.opacity(0.14), lineWidth: 1.5))
        }
    }

    private var foreground: Color {
        tier.isPremium ? Color(red: 0.24, green: 0.16, blue: 0.04) : .white
    }

    private var icon: String {
        switch tier {
        case .pro, .admin: return "crown.fill"
        case .agency: return "building.columns.fill"
        case .plus: return "plus.circle.fill"
        case .investor: return "chart.line.uptrend.xyaxis"
        case .basic: return "person.fill"
        }
    }

    private var subtitle: String {
        if profile == nil { return "Wczytuję dane konta…" }
        if let validity = profile?.membershipValidity, tier != .basic { return validity }
        return "Raporty rynkowe, wyróżnienia ofert i statystyki z EstateOS Pro."
    }

    private var callToAction: String {
        tier.isPremium ? "Zarządzaj planem na iPhonie" : "Przejdź na Pro"
    }
}

// MARK: - Gold

enum EOSGold {
    static let light = Color(red: 0.99, green: 0.91, blue: 0.68)
    static let mid = Color(red: 0.89, green: 0.72, blue: 0.40)
    static let deep = Color(red: 0.78, green: 0.58, blue: 0.26)

    static var metal: LinearGradient {
        LinearGradient(colors: [light, mid, light, deep], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    static var card: LinearGradient {
        LinearGradient(colors: [light, mid, Color(red: 0.97, green: 0.86, blue: 0.6), deep],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

/// Gold "PRO" mark — header capsule, account name, anywhere Pro should stand out.
struct EOSProBadge: View {
    enum Size { case small, large }
    var size: Size = .small

    var body: some View {
        HStack(spacing: size == .small ? 5 : 8) {
            Image(systemName: "crown.fill")
                .font(.system(size: size == .small ? 13 : 18, weight: .bold))
            Text("PRO")
                .font(.system(size: size == .small ? 16 : 22, weight: .heavy))
                .tracking(1.2)
        }
        .foregroundStyle(Color(red: 0.26, green: 0.17, blue: 0.04))
        .padding(.horizontal, size == .small ? 10 : 14)
        .padding(.vertical, size == .small ? 4 : 7)
        .background(Capsule().fill(EOSGold.metal))
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.5), lineWidth: 1))
        .shadow(color: EOSGold.deep.opacity(0.5), radius: 8, y: 2)
        .fixedSize()
        .accessibilityLabel("EstateOS Pro")
    }
}

// MARK: - Settings building blocks

private struct AccountGroup<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title)
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(.secondary)
                .padding(.leading, 6)
            content()
        }
    }
}

/// Settings row: tinted glyph tile, title and note; white with dark text when focused.
private struct AccountRowLabel<Trailing: View>: View {
    let icon: String
    let tint: Color
    let title: String
    var subtitle: String? = nil
    var destructive = false
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 22) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 52, height: 52)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(tint.gradient))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(destructive ? AnyShapeStyle(Color.red) : AnyShapeStyle(.primary))
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 19, weight: .regular))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: 16)
            trailing()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
    }
}

private struct AccountToggleRow: View {
    let icon: String
    let tint: Color
    let title: String
    let subtitle: String
    let isOn: Bool
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            AccountRowLabel(icon: icon, tint: tint, title: title, subtitle: subtitle) {
                if busy { ProgressView() } else { AccountSwitch(isOn: isOn) }
            }
        }
        .buttonStyle(AccountRowStyle())
        .accessibilityValue(isOn ? "Włączone" : "Wyłączone")
    }
}

private struct AccountActionRow: View {
    let icon: String
    let tint: Color
    let title: String
    let value: String?
    var chevron = false
    var destructive = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            AccountRowLabel(icon: icon, tint: tint, title: title, destructive: destructive) {
                HStack(spacing: 12) {
                    if let value {
                        Text(value)
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if chevron {
                        Image(systemName: "qrcode")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .buttonStyle(AccountRowStyle())
    }
}

/// iOS-style switch drawn for the TV (a Toggle can't sit inside a focusable row).
private struct AccountSwitch: View {
    let isOn: Bool

    var body: some View {
        Capsule()
            .fill(isOn ? Color.green : Color.primary.opacity(0.2))
            .frame(width: 84, height: 48)
            .overlay(alignment: isOn ? .trailing : .leading) {
                Circle().fill(.white).padding(4).shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.75), value: isOn)
    }
}

private struct AccountRowStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .environment(\.colorScheme, isFocused ? .light : scheme)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(isFocused ? Color.white : Color.primary.opacity(scheme == .dark ? 0.07 : 0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .strokeBorder(Color.primary.opacity(isFocused ? 0 : 0.08), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : (isFocused ? 1.03 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.35 : 0), radius: 24, y: 14)
            .animation(EOSMotion.focus, value: isFocused)
    }
}

/// Horizontal set of choices (theme, start screen, top shelf) under a small heading.
private struct AccountOptionStrip<Content: View>: View {
    let title: String
    let note: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                Text(title).font(.system(size: 22, weight: .semibold))
                if let note {
                    Text(note).font(.system(size: 17)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .padding(.leading, 6)
            HStack(spacing: 20) { content() }
        }
        .padding(.vertical, 6)
    }
}

private struct AccountOptionTile: View {
    let icon: String
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 30, weight: .semibold))
                Text(title).font(.system(size: 21, weight: .semibold)).lineLimit(1)
            }
            .frame(width: 210, height: 128)
            .overlay(alignment: .topTrailing) {
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.green)
                        .padding(10)
                }
            }
        }
        .buttonStyle(AccountTileStyle(selected: selected))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct AccountTileStyle: ButtonStyle {
    var selected: Bool
    @Environment(\.isFocused) private var isFocused
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(isFocused ? Color.black : Color.primary)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(isFocused ? Color.white : Color.primary.opacity(selected ? 0.14 : 0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(selected && !isFocused ? Color.green.opacity(0.8) : Color.primary.opacity(0.08),
                                  lineWidth: selected && !isFocused ? 2.5 : 1)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : (isFocused ? 1.07 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.35 : 0), radius: 20, y: 12)
            .animation(EOSMotion.focus, value: isFocused)
    }
}
