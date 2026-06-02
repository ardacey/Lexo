# MoneyPrinterTurbo (Windows) – Streamlit PATH Hatası ve `config.toml` Doldurma Rehberi

Bu rehber, Windows'ta şu hatayı yaşayanlar içindir:

- `pip list` içinde `streamlit` görünüyor
- ama PowerShell'de `streamlit` komutu çalışmıyor / tanınmıyor

Sebep genelde PowerShell'in sanal ortam içindeki `.\.venv\Scripts\streamlit.exe` dosyasını PATH'te görememesidir.

## 1) En güvenilir başlatma sırası (Windows)

PowerShell açın ve proje klasöründe sırayla çalıştırın:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Kontrol:

```powershell
python -m pip show streamlit
```

## 2) Streamlit komutu tanınmıyorsa 5 çözüm

### Seçenek 1 — Sanal ortamı tekrar aktif et
```powershell
.\.venv\Scripts\Activate.ps1
```

> Komutu parametresiz çalıştırın. Terminal başında `(.venv)` görünmeli.

### Seçenek 2 — CMD (Command Prompt) ile dene
```cmd
.venv\Scripts\activate.bat
streamlit run .\webui\Main.py --browser.gatherUsageStats=False
```

### Seçenek 3 — `webui.bat` kullan (önerilen)
```powershell
.\webui.bat
```

### Seçenek 4 — Python modülü olarak çalıştır
```powershell
python -m streamlit run .\webui\Main.py --browser.gatherUsageStats=False
```

### Seçenek 5 — Tam yol ile çalıştır
```powershell
.\.venv\Scripts\streamlit.exe run .\webui\Main.py --browser.gatherUsageStats=False
```

---

## 3) Verdiğin `config.toml` nasıl doldurulur?

Elindeki dosyada minimum çalışır (Ollama + Mistral + ücretsiz altyapı) örnek:

```toml
[app]
video_source = "pexels"
hide_config = false
edge_tts_timeout = 30
tls_verify = true
pexels_api_keys = ["BURAYA_PEXELS_API_KEY"]
pixabay_api_keys = []

llm_provider = "ollama"
ollama_base_url = "http://localhost:11434"
ollama_model_name = "mistral"

# OpenAI kullanmayacaksan boş kalabilir
openai_api_key = ""
openai_base_url = ""
openai_model_name = "gpt-4o-mini"

subtitle_provider = "edge"
endpoint = ""
material_directory = ""

[whisper]
model_size = "large-v3"
device = "CPU"
compute_type = "int8"

[ui]
hide_log = false
```

### Doldururken kısa notlar

- `llm_provider = "ollama"` yaptıysan:
  - `ollama_base_url` ve `ollama_model_name` dolu olmalı.
  - `openai_api_key` zorunlu değildir.
- `video_source = "pexels"` ise:
  - `pexels_api_keys` içine en az 1 API key gir.
- `subtitle_provider = "edge"` ücretsizdir, bu şekilde kalabilir.
- `tls_verify = true` olarak bırak (güvenlik için önerilen).
- Windows'ta ImageMagick otomatik bulunmazsa satırı açıp yolu ver:
  ```toml
  imagemagick_path = "C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe"
  ```

## 4) Son kontrol komutları

```powershell
ollama list
curl http://localhost:11434/api/tags
python -m streamlit --version
python -m streamlit run .\webui\Main.py --browser.gatherUsageStats=False
```

Tarayıcı: `http://127.0.0.1:8501`
