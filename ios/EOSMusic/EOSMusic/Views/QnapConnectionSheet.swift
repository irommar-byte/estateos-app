import SwiftUI

struct QnapConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var discovery = QnapDiscoveryService()

    let onConnect: (String, String, Int, String, String, String) async throws -> Void

    @State private var name = ""
    @State private var host = ""
    @State private var port = "5001"
    @State private var path = "/"
    @State private var username = ""
    @State private var password = ""
    @State private var isConnecting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Nazwa", text: $name, prompt: Text("Mój QNAP"))
                } header: {
                    Text("Nazwa folderu")
                }

                Section {
                    FilesListButton {
                        discovery.start()
                    } label: {
                        FilesActionRow(
                            icon: "antenna.radiowaves.left.and.right",
                            title: discovery.isSearching ? "Szukam w sieci…" : "Znajdź serwer",
                            iconColor: .blue
                        )
                    }
                    .disabled(discovery.isSearching)

                    if discovery.isSearching && discovery.servers.isEmpty {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Przeszukuję sieć lokalną…")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }

                    ForEach(discovery.servers) { server in
                        FilesListButton {
                            apply(server)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "server.rack")
                                    .font(.body)
                                    .foregroundStyle(.blue)
                                    .frame(width: 28, alignment: .center)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(server.displayName)
                                        .foregroundStyle(.primary)
                                    Text(server.subtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                    }

                    TextField("Adres serwera", text: $host, prompt: Text("np. qnap.local"))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                    TextField("Ścieżka", text: $path, prompt: Text("/Muzyka"))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Serwer WebDAV")
                } footer: {
                    Text("„Znajdź serwer” wykrywa NAS w Wi‑Fi. SMB (port 445) ≠ WebDAV — aplikacja łączy przez port 5001 (HTTPS) lub 5000 (HTTP). Włącz WebDAV w QNAP.")
                }

                Section {
                    TextField("Użytkownik", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Hasło", text: $password)
                } header: {
                    Text("Logowanie")
                } footer: {
                    Text("Włącz WebDAV w panelu QNAP (Control Panel → Network & File Services).")
                }

                Section {
                    FilesListButton { Task { await connect() } } label: {
                        FilesActionRow(
                            icon: "link",
                            title: isConnecting ? "Łączenie…" : "Połącz z QNAP",
                            iconColor: .blue
                        )
                    }
                    .disabled(isConnecting || host.trimmingCharacters(in: .whitespaces).isEmpty || username.isEmpty)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("QNAP")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
            }
            .onDisappear { discovery.stop() }
            .overlay {
                if isConnecting {
                    ProgressView("Łączę…")
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func apply(_ server: DiscoveredNasServer) {
        host = server.host
        port = String(server.webDAVPort)
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            name = server.displayName
        }
        discovery.stop()
    }

    private func connect() async {
        isConnecting = true
        defer { isConnecting = false }
        let portValue = Int(port) ?? 5001
        do {
            try await onConnect(
                name.trimmingCharacters(in: .whitespaces),
                host.trimmingCharacters(in: .whitespaces),
                portValue,
                path.trimmingCharacters(in: .whitespaces),
                username.trimmingCharacters(in: .whitespaces),
                password
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
