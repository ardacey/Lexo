# Lexo + Ollama (Mistral) Detaylı Başlangıç Rehberi (Türkçe)

Bu rehber, bilgisayarında **Ollama + Mistral** kurulu olan bir kullanıcının Lexo projesini ayağa kaldırıp test etmesi için hazırlanmıştır.

> Not: Lexo doğrudan `config.toml` ile çalışmaz; backend ayarları `.env` üzerinden yönetilir. Bu rehberdeki `config.toml` adımı, Ollama/Mistral bağlantı bilgilerini tek bir dosyada toplamak isteyen kullanıcılar için pratik bir başlangıç şablonu sunar.

## 1) Projeyi Klonlama

```bash
git clone https://github.com/ardacey/Lexo.git
cd Lexo
```

**Ekran görüntüsü açıklaması:** Terminalde `git clone` komutunun başarılı olduğu ve klasör içine girildikten sonra `README.md`, `lexo`, `lexo-backend` dizinlerinin göründüğü bir ekran.

---

## 2) Ortamı Kurma (Python Sanal Ortam)

```bash
cd lexo-backend
python3 -m venv .venv
source .venv/bin/activate
```

Windows (PowerShell):

```powershell
cd lexo-backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**Ekran görüntüsü açıklaması:** Komut satırında satır başında `(.venv)` önekinin belirdiği bir terminal görüntüsü.

---

## 3) Bağımlılık Yükleme

Backend bağımlılıkları:

```bash
pip install -r requirements.txt
```

Frontend (Web UI) kullanacaksan:

```bash
cd ../lexo
npm install
```

**Ekran görüntüsü açıklaması:** `pip install` ve `npm install` tamamlandıktan sonra hata olmadan prompt’un geri geldiği terminal görüntüsü.

---

## 4) Konfigürasyon (`config.toml`) – Ollama/Mistral Entegrasyonu

Proje kökünde bir `config.toml` oluştur:

```toml
[llm]
provider = "ollama"
model = "mistral"
base_url = "http://127.0.0.1:11434"
temperature = 0.7
timeout = 120
```

Ardından Ollama servisinin ve modelin hazır olduğunu doğrula:

```bash
ollama list
ollama run mistral "Merhaba, Lexo kurulumu için kısa bir kontrol mesajı yaz."
```

**Ekran görüntüsü açıklaması:** `ollama list` çıktısında `mistral` modelinin listelendiği ve `ollama run mistral` komutundan metin yanıtı alındığı terminal görüntüsü.

---

## 5) Projeyi Başlatma (Web UI veya API)

### API (FastAPI Backend)

```bash
cd lexo-backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI: `http://127.0.0.1:8000/docs`

### Web UI (Expo Web)

```bash
cd lexo
npm run web
```

Genelde `http://localhost:8081` üzerinde açılır.

**Ekran görüntüsü açıklaması:**  
- API için: Tarayıcıda `/docs` sayfasında endpoint listesinin göründüğü ekran.  
- Web UI için: Expo geliştirici sunucusunun terminal logları ve tarayıcıda açılan uygulama ekranı.

---

## 6) Test Etme (Doğrulama)

Backend testlerini çalıştır:

```bash
cd lexo-backend
pytest tests/ -q
```

Temel API sağlık kontrolü:

```bash
curl http://127.0.0.1:8000/
curl http://127.0.0.1:8000/stats
```

Ollama/Mistral doğrulaması:

```bash
ollama run mistral "Sistem testi başarılıysa tek cümlelik onay ver."
```

**Ekran görüntüsü açıklaması:** `pytest` sonuç özetinde testlerin koştuğu; `curl` komutlarında JSON döndüğü; `ollama run` çıktısında model cevabının görüldüğü terminal ekranı.

---

## 7) Sorun Giderme (Yaygın Hatalar ve Çözümler)

### Hata: `ollama: command not found`
- Çözüm: Ollama PATH’e ekli olmayabilir. Terminali yeniden aç, `ollama --version` ile doğrula.

### Hata: `connection refused 127.0.0.1:11434`
- Çözüm: Ollama servisi çalışmıyordur. Arka planda Ollama’nın açık olduğundan emin ol.

### Hata: `ModuleNotFoundError` veya paket eksikliği
- Çözüm: Sanal ortam aktif mi kontrol et (`(.venv)`), sonra tekrar:
  ```bash
  pip install -r requirements.txt
  ```

### Hata: Port çakışması (`8000 already in use`)
- Çözüm: Farklı portla başlat:
  ```bash
  uvicorn app.main:app --reload --port 8001
  ```

### Hata: Frontend açılmıyor / Expo bağımlılık hatası
- Çözüm:
  ```bash
  cd lexo
  rm -rf node_modules package-lock.json
  npm install
  npm run web
  ```

**Ekran görüntüsü açıklaması:** Her hata için terminalde hata mesajı ve hemen altında uygulanan çözüm komutunun başarılı çıktısını gösteren karşılaştırmalı görüntü.
