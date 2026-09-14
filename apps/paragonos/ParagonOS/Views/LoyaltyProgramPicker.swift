import SwiftUI

struct LoyaltyProgramPicker: View {
    var title: String = "Wybierz sklep"
    var onPick: (LoyaltyProgram) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var customName = ""

    private var programs: [LoyaltyProgram] {
        LoyaltyCatalog.search(query)
    }

    var body: some View {
        NavigationStack {
            List {
                if programs.isEmpty {
                    ContentUnavailableView(
                        "Brak sklepów",
                        systemImage: "storefront",
                        description: Text("Spróbuj innej nazwy albo dodaj sklep ręcznie na dole listy.")
                    )
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(programs) { program in
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                onPick(program)
                                dismiss()
                            } label: {
                            HStack(spacing: 14) {
                                LoyaltyLogo(program: program, size: 44)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(program.name)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(.primary)
                                    if program.programName != program.name {
                                        Text(program.programName)
                                            .font(.footnote)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section {
                    HStack(spacing: 10) {
                        TextField("Nazwa sklepu", text: $customName)
                            .textInputAutocapitalization(.words)
                        Button("Dodaj") {
                            let program = LoyaltyProgram.custom(name: customName)
                            onPick(program)
                            dismiss()
                        }
                        .disabled(customName.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                    }
                } header: {
                    Text("Inny sklep")
                } footer: {
                    Text("\(Brand.displayName) nie jest powiązany z tymi sieciami.")
                }
            }
            .listStyle(.plain)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Szukaj sklepu")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
            }
        }
    }
}
