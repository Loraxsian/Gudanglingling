"""
Basis Pengetahuan (Knowledge Base) GudangLingling AI
Sesuai Materi Perkuliahan Artificial Intelligence:
- Modul 3.2: State-Space Representation
- Modul 6.7: Forward Chaining & Certainty Factor
- Modul 4.5: Heuristic Risk Evaluation Function

Pengembang: Liana Sry Astuti (NIM: 2422031)
Dosen Pengampu: Bapak Deosa Putra Caniago, M.Kom
Institut Teknologi Batam (ITEBA)
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class Decision:
    code: str
    name: str
    description: str
    action_recommendation: str
    default_zone: str  # GREEN, YELLOW, RED


@dataclass
class Fact:
    code: str
    name: str
    question_prompt: str
    category: str
    risk_weight: float  # Bobot heuristik wi in [0, 40]
    is_critical_red_flag: bool = False


@dataclass
class Rule:
    code: str
    premises: List[str]  # Daftar kode fakta F_xx
    operator: str  # "AND" atau "OR"
    conclusion: str  # Kode keputusan K_xx
    mb: float  # Measure of Belief (0.0 - 1.0)
    md: float  # Measure of Disbelief (0.0 - 1.0)
    cf_pakar: float  # CF = MB - MD
    explanation: str


# -------------------------------------------------------------
# 5 Kategori Keputusan / Status Kondisi (K01 - K05)
# -------------------------------------------------------------
DECISIONS: Dict[str, Decision] = {
    "K01": Decision(
        code="K01",
        name="Layak Pakai Optimal",
        description="Alat dalam kondisi prima, semua komponen pengaman bekerja normal, dan profil peminjam memenuhi standar keselamatan.",
        action_recommendation="Peminjaman disetujui langsung. Terbitkan lembar checklist digital dan kirimkan konfirmasi via WhatsApp.",
        default_zone="GREEN"
    ),
    "K02": Decision(
        code="K02",
        name="Degradasi Komponen Mekanis",
        description="Terdeteksi keausan komponen fisik (mata tumpul, pelumas mengering, baut longgar). Alat masih berfungsi namun membutuhkan perawatan ringan.",
        action_recommendation="Peminjaman bersyarat diizinkan. Pengguna wajib melakukan pengencangan/pelumasan sebelum dinyalakan dan wajib mengenakan sarung tangan.",
        default_zone="YELLOW"
    ),
    "K03": Decision(
        code="K03",
        name="Risiko Bahaya Fatal Kelistrikan / Kerusakan Kritis",
        description="Terdeteksi red flag kebocoran arus listrik, isolasi terbuka, motor memercik api, bodi mengalirkan induksi, atau mata gerinda retak.",
        action_recommendation="DITOLAK OTOMATIS (LOCKOUT). Alat langsung dikarantina ke status 'Dalam Perbaikan' demi mencegah kecelakaan fatal dan sengatan listrik.",
        default_zone="RED"
    ),
    "K04": Decision(
        code="K04",
        name="Ketidaksesuaian Profil Peminjam / Beban Kerja Berlebih",
        description="Alat berkategori risiko tinggi (daya listrik besar atau pisau putar cepat) dipinjam oleh pemula tanpa pengalaman, tanpa APD, atau di bawah umur.",
        action_recommendation="Peminjaman dibatasi / butuh pendampingan anggota keluarga berpengalaman. Wajib melengkapi APD sebelum alat diserahkan.",
        default_zone="YELLOW"
    ),
    "K05": Decision(
        code="K05",
        name="Rekomendasi Alat Alternatif Tepat Guna",
        description="Beban pekerjaan peminjam tergolong ringan atau tidak cocok dengan spesifikasi alat berat yang diminta.",
        action_recommendation="Arahkan peminjam ke alat alternatif yang lebih aman dan hemat energi (misal: gunakan obeng/bor baterai daripada bor bobok beton kabel).",
        default_zone="GREEN"
    )
}

# -------------------------------------------------------------
# 20 Indikator Fakta/Gejala Teknis & Profil Peminjam (F01 - F20)
# Dilengkapi bobot risiko heuristik w_i (0 - 40)
# -------------------------------------------------------------
FACTS: Dict[str, Fact] = {
    # Gejala Fisik & Kelistrikan Alat (F01 - F12)
    "F01": Fact(
        code="F01",
        name="Kabel daya terkelupas / isolasi terbuka",
        question_prompt="Apakah kabel daya terlihat terkelupas, rapuh, atau ada sambungan isolasi selotip terbuka?",
        category="Kelistrikan",
        risk_weight=35.0,
        is_critical_red_flag=True
    ),
    "F02": Fact(
        code="F02",
        name="Steker / colokan goyang, leleh, atau gosong",
        question_prompt="Apakah colokan (steker) goyang, menghitam terbakar, atau terasa meleleh?",
        category="Kelistrikan",
        risk_weight=30.0,
        is_critical_red_flag=False
    ),
    "F03": Fact(
        code="F03",
        name="Motor listrik memercik api berlebih / bau sangit",
        question_prompt="Saat mesin dijalankan sebentar, apakah timbul percikan api besar dari dinamo atau tercium bau sangit/hangus?",
        category="Kelistrikan & Motor",
        risk_weight=35.0,
        is_critical_red_flag=True
    ),
    "F04": Fact(
        code="F04",
        name="Bodi alat mengalirkan induksi listrik (nyetrum)",
        question_prompt="Apakah bodi logam alat terasa menyengat atau bertegangan saat disentuh testpen?",
        category="Kelistrikan",
        risk_weight=40.0,
        is_critical_red_flag=True
    ),
    "F05": Fact(
        code="F05",
        name="Mata pisau / mata bor tumpul atau aus",
        question_prompt="Apakah mata bor, mata pisau potong, atau bilah gergaji sudah tumpul?",
        category="Mekanis",
        risk_weight=15.0,
        is_critical_red_flag=False
    ),
    "F06": Fact(
        code="F06",
        name="Mata gergaji / piringan gerinda retak atau sumbing",
        question_prompt="Apakah piringan batu gerinda atau mata gergaji memiliki retakan rambut atau sumbing pada tepiannya?",
        category="Mekanis",
        risk_weight=35.0,
        is_critical_red_flag=True
    ),
    "F07": Fact(
        code="F07",
        name="Baut pengunci bilah / chuck bor longgar atau slek",
        question_prompt="Apakah mekanisme pengunci bilah pisau atau kepala bor terasa kendor atau ulirnya slek?",
        category="Mekanis",
        risk_weight=25.0,
        is_critical_red_flag=False
    ),
    "F08": Fact(
        code="F08",
        name="Pelindung keselamatan (safety guard) dilepas / hilang",
        question_prompt="Apakah penutup pengaman bilah berputar (safety guard) dilepas atau tidak terpasang?",
        category="Keselamatan Alat",
        risk_weight=30.0,
        is_critical_red_flag=False
    ),
    "F09": Fact(
        code="F09",
        name="Engsel / pengunci tangga lipat goyang atau aus",
        question_prompt="Untuk tangga lipat, apakah engsel, tali penyangga, atau karet kaki tampak goyang dan licin?",
        category="Fisik / Struktur",
        risk_weight=35.0,
        is_critical_red_flag=False
    ),
    "F10": Fact(
        code="F10",
        name="Suara mesin berdecit kasar (pelumas kering/bearing aus)",
        question_prompt="Apakah terdengar gesekan logam menjerit kasar yang mengindikasikan bearing kering atau aus?",
        category="Mekanis",
        risk_weight=15.0,
        is_critical_red_flag=False
    ),
    "F11": Fact(
        code="F11",
        name="Tuas pengaman (dead man's switch) macet / diganjal",
        question_prompt="Apakah saklar pengaman otomatis macet atau sengaja diganjal agar mesin terus berputar?",
        category="Keselamatan Alat",
        risk_weight=35.0,
        is_critical_red_flag=True
    ),
    "F12": Fact(
        code="F12",
        name="Tombol On/Off macet pada posisi ON",
        question_prompt="Apakah saklar utama macet dan sulit dimatikan secara instan jika terjadi keadaan darurat?",
        category="Kontrol Alat",
        risk_weight=30.0,
        is_critical_red_flag=True
    ),

    # Profil Peminjam, Lingkungan & Karakter Tugas (F13 - F20)
    "F13": Fact(
        code="F13",
        name="Peminjam pemula (belum pernah mengoperasikan alat jenis ini)",
        question_prompt="Apakah peminjam baru pertama kali menggunakan jenis alat bertorsi/berdaya tinggi ini?",
        category="Profil Peminjam",
        risk_weight=25.0,
        is_critical_red_flag=False
    ),
    "F14": Fact(
        code="F14",
        name="Peminjam tidak memiliki / tidak memakai APD",
        question_prompt="Apakah peminjam menyatakan tidak memiliki alat pelindung diri dasar (kacamata safety, masker, sarung tangan)?",
        category="Profil Peminjam",
        risk_weight=20.0,
        is_critical_red_flag=False
    ),
    "F15": Fact(
        code="F15",
        name="Rencana penggunaan di area lembab / basah / genangan air",
        question_prompt="Apakah pengerjaan akan dilakukan di luar ruangan basah, dekat selokan, atau permukaan licin?",
        category="Lingkungan Kerja",
        risk_weight=35.0,
        is_critical_red_flag=False
    ),
    "F16": Fact(
        code="F16",
        name="Rencana beban kerja melebihi kapasitas standar alat",
        question_prompt="Apakah alat akan dipaksa menembus beton bertulang tebal / memotong logam tebal yang melampaui batas spesifikasi?",
        category="Kapasitas Tugas",
        risk_weight=25.0,
        is_critical_red_flag=False
    ),
    "F17": Fact(
        code="F17",
        name="Peminjam anak-anak / di bawah umur tanpa pengawasan dewasa",
        question_prompt="Apakah yang akan mengoperasikan alat adalah anak-anak atau remaja di bawah umur tanpa pendampingan orang tua?",
        category="Profil Peminjam",
        risk_weight=40.0,
        is_critical_red_flag=True
    ),
    "F18": Fact(
        code="F18",
        name="Durasi pemakaian maraton panjang tanpa pendinginan",
        question_prompt="Apakah alat direncanakan dipakai nonstop berjam-jam tanpa jeda istirahat motor?",
        category="Kapasitas Tugas",
        risk_weight=15.0,
        is_critical_red_flag=False
    ),
    "F19": Fact(
        code="F19",
        name="Pekerjaan di ketinggian tinggi (> 3 meter)",
        question_prompt="Apakah alat/tangga akan dipakai untuk memanjat atau merenovasi plafon/atap setinggi lebih dari 3 meter?",
        category="Lingkungan Kerja",
        risk_weight=25.0,
        is_critical_red_flag=False
    ),
    "F20": Fact(
        code="F20",
        name="Kebutuhan hanya untuk perbaikan skala mikro / estetika rumah tangga",
        question_prompt="Apakah pekerjaannya sebenarnya sepele (misal sekadar pasang pigura foto, kencangkan baut lemari, atau bersihkan debu)?",
        category="Tujuan Penggunaan",
        risk_weight=5.0,
        is_critical_red_flag=False
    )
}

# -------------------------------------------------------------
# 15 Kaidah Produksi (Rules R01 - R15)
# Dilengkapi MB, MD, dan CF Pakar
# -------------------------------------------------------------
RULES: List[Rule] = [
    Rule(
        code="R01",
        premises=["F01", "F04"],
        operator="OR",
        conclusion="K03",
        mb=0.95,
        md=0.00,
        cf_pakar=0.95,
        explanation="Jika kabel daya terkelupas atau bodi mengalirkan induksi sengatan listrik, maka risiko bahaya fatal kelistrikan sangat tinggi."
    ),
    Rule(
        code="R02",
        premises=["F02", "F03"],
        operator="AND",
        conclusion="K03",
        mb=0.90,
        md=0.00,
        cf_pakar=0.90,
        explanation="Jika steker goyang/gosong dan motor memercikkan api berlebih, maka berisiko memicu kebakaran atau korsleting fatal."
    ),
    Rule(
        code="R03",
        premises=["F05", "F10"],
        operator="AND",
        conclusion="K02",
        mb=0.85,
        md=0.00,
        cf_pakar=0.85,
        explanation="Jika mata pisau/bor tumpul dan suara mesin berdecit kasar, maka komponen mekanis mengalami degradasi dan butuh pelumasan serta asah."
    ),
    Rule(
        code="R04",
        premises=["F06"],
        operator="AND",
        conclusion="K03",
        mb=0.95,
        md=0.00,
        cf_pakar=0.95,
        explanation="Jika piringan gerinda atau mata gergaji retak sumbing, piringan dapat meledak berhamburan saat putaran tinggi dan melukai peminjam."
    ),
    Rule(
        code="R05",
        premises=["F07", "F08"],
        operator="AND",
        conclusion="K02",
        mb=0.80,
        md=0.00,
        cf_pakar=0.80,
        explanation="Jika chuck/baut longgar dan safety guard dilepas, terjadi degradasi sistem pengamanan mekanis yang harus diperbaiki sebelum pakai."
    ),
    Rule(
        code="R06",
        premises=["F09", "F19"],
        operator="AND",
        conclusion="K03",
        mb=0.90,
        md=0.00,
        cf_pakar=0.90,
        explanation="Jika engsel/kaki tangga goyang dan digunakan di ketinggian lebih dari 3 meter, terdapat risiko fatal jatuh dari ketinggian."
    ),
    Rule(
        code="R07",
        premises=["F11", "F12"],
        operator="OR",
        conclusion="K03",
        mb=0.85,
        md=0.00,
        cf_pakar=0.85,
        explanation="Jika tuas pengaman darurat macet/diganjal atau tombol daya macet di posisi ON, alat kehilangan kendali darurat dan berbahaya."
    ),
    Rule(
        code="R08",
        premises=["F13", "F14"],
        operator="AND",
        conclusion="K04",
        mb=0.85,
        md=0.00,
        cf_pakar=0.85,
        explanation="Jika peminjam adalah pemula dan tidak memiliki perlengkapan APD standar, maka profil peminjam tidak memadai untuk alat berbahaya."
    ),
    Rule(
        code="R09",
        premises=["F15", "F01"],
        operator="AND",
        conclusion="K03",
        mb=0.98,
        md=0.00,
        cf_pakar=0.98,
        explanation="Jika area kerja basah/lembab dan kabel alat terkelupas, risiko tersengat aliran arus fatal mencapai tingkat ekstrem."
    ),
    Rule(
        code="R10",
        premises=["F13", "F16"],
        operator="AND",
        conclusion="K04",
        mb=0.80,
        md=0.00,
        cf_pakar=0.80,
        explanation="Jika peminjam pemula hendak memaksakan alat melebihi kapasitasnya, risiko kickback atau mesin jebol sangat tinggi."
    ),
    Rule(
        code="R11",
        premises=["F17"],
        operator="AND",
        conclusion="K04",
        mb=0.99,
        md=0.00,
        cf_pakar=0.99,
        explanation="Peminjam di bawah umur dilarang keras mengoperasikan perkakas berat tanpa pendampingan intensif orang tua."
    ),
    Rule(
        code="R12",
        premises=["F20", "F13"],
        operator="AND",
        conclusion="K05",
        mb=0.85,
        md=0.00,
        cf_pakar=0.85,
        explanation="Jika pekerjaan hanya perbaikan mikro dan peminjam adalah pemula, sarankan penggunaan alat manual/baterai portabel yang jauh lebih aman."
    ),
    Rule(
        code="R13",
        premises=["F16", "F05"],
        operator="AND",
        conclusion="K05",
        mb=0.75,
        md=0.00,
        cf_pakar=0.75,
        explanation="Jika hendak mengebor/memotong material keras dengan mata yang sudah aus, rekomendasikan penggantian mata atau beralih ke alat heavy duty."
    ),
    Rule(
        code="R14",
        premises=[],  # Kaidah Default: Evaluasi Negatif seluruh red flag
        operator="DEFAULT_OPTIMAL",
        conclusion="K01",
        mb=0.95,
        md=0.00,
        cf_pakar=0.95,
        explanation="Jika seluruh pemeriksaan teknis dan profil peminjam bebas dari indikasi kerusakan dan bahaya, alat dinyatakan Layak Pakai Optimal."
    ),
    Rule(
        code="R15",
        premises=["F05"],
        operator="AND",
        conclusion="K02",
        mb=0.75,
        md=0.00,
        cf_pakar=0.75,
        explanation="Jika hanya ditemukan keausan pada mata potong tanpa indikasi korsleting, alat masih layak dengan catatan perlu diasah terlebih dahulu."
    )
]
