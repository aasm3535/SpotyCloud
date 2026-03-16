# 🚀 Релизный гайд SpotyCloud

## Как выпустить обновление (v0.4.0 и далее)

### Шаг 1: Обновить версию

В **трёх файлах** должна быть одинаковая версия:

1. `package.json` → `"version": "0.4.0"`
2. `src-tauri/Cargo.toml` → `version = "0.4.0"`
3. `src-tauri/tauri.conf.json` → `"version": "0.4.0"`

### Шаг 2: Закоммитить изменения

```bash
git add -A
git commit -m "release: v0.4.0 - Описание что изменилось"
```

### Шаг 3: Запушить коммит

**ВАЖНО**: Сначала пушим коммит, потом создаём тег!

```bash
git push origin master
```

### Шаг 4: Создать и запушить тег

```bash
git tag -a v0.4.0 -m "Release v0.4.0 - Описание"
git push origin v0.4.0
```

### Что произойдёт автоматически

GitHub Actions запустит workflow который:
1. ✅ Соберёт Windows (.exe + .msi)
2. ✅ Соберёт macOS Apple Silicon (.dmg + .app.tar.gz)
3. ✅ Соберёт macOS Intel (.dmg + .app.tar.gz)
4. ✅ Создаст `latest.json` с правильными URL и сигнатурами
5. ✅ Зальёт всё в Release

### Как проверить что всё ок

1. Идёшь в [Releases](https://github.com/aasm3535/SpotyCloud/releases)
2. Проверяешь что в релизе есть:
   - [ ] `spotycloud_0.4.0_x64-setup.exe`
   - [ ] `spotycloud_0.4.0_x64-setup.exe.sig`
   - [ ] `spotycloud_aarch64.app.tar.gz`
   - [ ] `spotycloud_aarch64.app.tar.gz.sig`
   - [ ] `spotycloud_x64.app.tar.gz`
   - [ ] `spotycloud_x64.app.tar.gz.sig`
   - [ ] `latest.json` (содержит сигнатуры, не пустой!)

3. Проверяешь `latest.json` - должен содержать заполненные "signature" поля

### Если что-то пошло не так

**Проблема**: Билд пропущен (тег уже существует)
```bash
# Удалить и пересоздать тег
git tag -d v0.4.0
git push origin --delete v0.4.0
git tag -a v0.4.0 -m "Release v0.4.0"
git push origin v0.4.0
```

**Проблема**: `latest.json` пустой или без сигнатур
- Подожди 5-10 минут - job `create-updater` запускается после всех билдов
- Если всё ещё пустой - проверь логи GitHub Actions

### Как работает Auto Update

1. При запуске приложение проверяет `https://github.com/aasm3535/SpotyCloud/releases/latest/download/latest.json`
2. Если версия в `latest.json` новее текущей - показывает уведомление об обновлении
3. Пользователь кликает "Обновить" → скачивается новая версия → автоматическая установка

### Важные моменты

- **Версия** должна быть одинаковой во всех 3 файлах
- **Тег** должен начинаться с `v` (v0.4.0, не 0.4.0)
- **macOS** использует `.app.tar.gz` для обновлений, `.dmg` только для ручной установки
- **Сигнатуры** нужны для безопасности - без них updater не будет работать
- **Пушь сначала коммит, потом тег** - иначе workflow может запуститься дважды

---

## Быстрая шпаргалка

```bash
# 1. Обновить версии в файлах
# 2. Коммит
git add -A && git commit -m "release: v0.4.0"

# 3. Пуш
git push origin master

# 4. Тег
git tag -a v0.4.0 -m "Release v0.4.0"
git push origin v0.4.0

# 5. Ждём 10 минут и проверяем релиз
```

## Что было исправлено в v0.4.0

- ✅ Исправлены URLs для macOS (теперь используются .app.tar.gz)
- ✅ Добавлено автоматическое чтение сигнатур из .sig файлов
- ✅ Workflow теперь ждёт завершения всех билдов перед созданием latest.json
- ✅ Добавлена проверка существования тега (избегаем двойных билдов)
