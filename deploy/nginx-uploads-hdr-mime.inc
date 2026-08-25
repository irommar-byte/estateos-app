# MIME dla zdjęć HDR z iPhone (HEIC/HEIF). Domyślny mime.types nginx ich nie zna,
# więc master `.heic` szedł jako octet-stream i Safari nie rozświetlało HDR.
types {
    image/jpeg                         jpeg jpg;
    image/png                          png;
    image/gif                          gif;
    image/webp                         webp;
    image/heic                         heic HEIC;
    image/heif                         heif HEIF;
    application/json                   json;
    model/vnd.usdz+zip                 usdz;
}
