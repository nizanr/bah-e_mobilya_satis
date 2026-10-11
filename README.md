# Bahçe Mobilyası Mağazası

Bahçe mobilyalarını keşfedebileceğiniz, ürünleri sepetinize ekleyip sipariş verebileceğiniz ve bir bahçe fotoğrafında mobilya yerleşimini deneyebileceğiniz responsive e-ticaret demosu.

## Çalıştırma

Node.js 18 veya üzeri gereklidir. Harici paket kurmadan:

```sh
npm start
```

Uygulama `http://localhost:3000` adresinde açılır. Testleri çalıştırmak için:

```sh
npm test
```

## Özellikler

- Ürünleri kategoriye göre filtreleme, arama ve ürün detaylarını görüntüleme
- Üyelik ve giriş; sepete ürün ekleme, adet değiştirme ve sipariş oluşturma
- JPG/PNG bahçe fotoğrafı yükleyip seçilen mobilya çizimini sürükleme, ölçekleme ve döndürme
- Mobil ekranlara uyumlu arayüz

Fotoğraf tarayıcıda işlenir ve sunucuya gönderilmez. Ürün kataloğu `data/products.json` dosyasından başlatılır. Üyeler, siparişler ve yönetici API'sinden eklenen ürünler ilk çalıştırmada `data/store.json` dosyasına kaydedilir; bu dosya Git'e eklenmez.

## API

- `GET /api/products?category=Masa&q=ahşap` — katalog, kategori ve arama filtresi
- `GET /api/products/:id` — ürün detayı
- `POST /api/register` ve `POST /api/login` — üyelik ve giriş
- `POST /api/orders` — `x-session-token` başlığıyla sipariş
- `POST /api/products` — `ADMIN_TOKEN` ortam değişkeniyle korunan katalog ekleme
