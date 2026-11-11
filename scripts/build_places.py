"""Собирает public/places-ua.json — справочник населённых пунктов Украины с украинскими и русскими названиями.

Источник: GeoNames (CC BY 4.0), https://download.geonames.org/export/dump/
  UA.zip                 -> UA.txt (объекты Украины)
  alternatenames/UA.zip  -> UA.txt (названия на разных языках)

Запуск:
  python3 scripts/build_places.py <путь к основному UA.txt> <путь к alternatenames UA.txt> public/places-ua.json

Формат результата (компактный, чтобы файл был маленьким):
  {"regions": [[ru, uk], ...], "places": [[ru, uk, regionIdx, lat, lon, population, nearCityIdx, nearKm], ...]}
  nearCityIdx — индекс (в places) ближайшего города с населением >= NEAR_CITY_MIN_POP, для подсказки
  «20 км от Славянска», чтобы различать одноимённые сёла. -1, если пункт сам такой город.
"""
import json
import math
import re
import sys

CYRILLIC = re.compile(r"[А-Яа-яЁёІіЇїЄєҐґ]")
NEAR_CITY_MIN_POP = 40_000

# admin1-коды GeoNames -> (русское, украинское) название области.
OBLASTS = {
    "01": ("Черкасская обл.", "Черкаська обл."), "02": ("Черниговская обл.", "Чернігівська обл."),
    "03": ("Черновицкая обл.", "Чернівецька обл."), "04": ("Днепропетровская обл.", "Дніпропетровська обл."),
    "05": ("Донецкая обл.", "Донецька обл."), "06": ("Ивано-Франковская обл.", "Івано-Франківська обл."),
    "07": ("Харьковская обл.", "Харківська обл."), "08": ("Херсонская обл.", "Херсонська обл."),
    "09": ("Хмельницкая обл.", "Хмельницька обл."), "10": ("Кировоградская обл.", "Кіровоградська обл."),
    "11": ("Крым", "Крим"), "12": ("Киев", "Київ"), "13": ("Киевская обл.", "Київська обл."),
    "14": ("Луганская обл.", "Луганська обл."), "15": ("Львовская обл.", "Львівська обл."),
    "16": ("Николаевская обл.", "Миколаївська обл."), "17": ("Одесская обл.", "Одеська обл."),
    "18": ("Полтавская обл.", "Полтавська обл."), "19": ("Ровенская обл.", "Рівненська обл."),
    "20": ("Севастополь", "Севастополь"), "21": ("Сумская обл.", "Сумська обл."),
    "22": ("Тернопольская обл.", "Тернопільська обл."), "23": ("Винницкая обл.", "Вінницька обл."),
    "24": ("Волынская обл.", "Волинська обл."), "25": ("Закарпатская обл.", "Закарпатська обл."),
    "26": ("Запорожская обл.", "Запорізька обл."), "27": ("Житомирская обл.", "Житомирська обл."),
}

# Части города, заброшенные, исторические, разрушенные и т.п. — не нужны.
SKIP_CODES = {"PPLX", "PPLQ", "PPLH", "PPLW", "PPLF", "PPLCH"}


def pick_names(alt_path):
    """geonameid -> {lang: name}. Предпочитаем «preferred», избегаем исторических и разговорных."""
    best = {}  # (id, lang) -> (score, name)
    with open(alt_path, encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            lang = c[2]
            if lang not in ("ru", "uk") or not CYRILLIC.search(c[3]):
                continue
            preferred, short, colloquial, historic = (c[i] == "1" for i in range(4, 8))
            if colloquial or historic:
                continue
            score = (2 if preferred else 0) + (0 if short else 1)
            key = (c[1], lang)
            if key not in best or score > best[key][0]:
                best[key] = (score, c[3])
    names = {}
    for (gid, lang), (_, name) in best.items():
        names.setdefault(gid, {})[lang] = name
    return names


def km(a_lat, a_lon, b_lat, b_lon):
    r = math.radians
    h = math.sin(r(b_lat - a_lat) / 2) ** 2 + math.cos(r(a_lat)) * math.cos(r(b_lat)) * math.sin(r(b_lon - a_lon) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def main(main_path, alt_path, out_path):
    names = pick_names(alt_path)
    regions = [list(v) for v in OBLASTS.values()]
    places = []
    with open(main_path, encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if c[6] != "P" or c[7] in SKIP_CODES:
                continue
            n = names.get(c[0], {})
            uk = n.get("uk", "")
            ru = n.get("ru") or uk
            if not ru:
                continue  # нет ни русского, ни украинского названия
            region = OBLASTS.get(c[10])
            places.append([
                ru,
                uk if uk != ru else "",
                regions.index(list(region)) if region else -1,
                round(float(c[4]), 4),
                round(float(c[5]), 4),
                int(c[14] or 0),
            ])

    # Крупные пункты первыми — поиск идёт по порядку и берёт первые совпадения.
    places.sort(key=lambda p: -p[5])
    cities = [i for i, p in enumerate(places) if p[5] >= NEAR_CITY_MIN_POP]
    for i, p in enumerate(places):
        if p[5] >= NEAR_CITY_MIN_POP:
            p += [-1, 0]
            continue
        j = min(cities, key=lambda k: km(p[3], p[4], places[k][3], places[k][4]))
        p += [j, round(km(p[3], p[4], places[j][3], places[j][4]))]

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"regions": regions, "places": places}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(places)} пунктов, {len(cities)} опорных городов -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
