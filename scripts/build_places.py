"""Собирает packages/core/data/places-ua.json — справочник населённых пунктов Украины.

Источник: GeoNames (CC BY 4.0), https://download.geonames.org/export/dump/
  UA.zip                 -> UA.txt (объекты Украины, включая районы — ADM2)
  alternatenames/UA.zip  -> UA.txt (названия на разных языках)

Запуск:
  python3 scripts/build_places.py <путь к основному UA.txt> <путь к alternatenames UA.txt> packages/core/data/places-ua.json

Формат результата (компактный, чтобы файл был маленьким):
  {"regions": [uk, ...],
   "districts": [uk, ...],
   "places": [[id, uk, ru, regionIdx, districtIdx, lat, lon, population, nearCityIdx, nearKm], ...]}
  id — geonameid: не меняется при пересборке, поэтому сохранённая в браузере история остаётся верной.
  uk — название для показа (если украинского в GeoNames нет — русское).
  ru — русское название, только для поиска; пустая строка, если совпадает с uk.
  districtIdx — район (после реформы 2020 г.), -1 если неизвестен. Район различает одноимённые сёла одной области.
  nearCityIdx — индекс (в places) ближайшего города с населением >= NEAR_CITY_MIN_POP, для подсказки
  «20 км від м. Слов’янськ». -1, если пункт сам такой город.
"""
import json
import math
import re
import sys

CYRILLIC = re.compile(r"[А-Яа-яЁёІіЇїЄєҐґ]")
APOSTROPHES = re.compile(r"['ʼ`]")
NEAR_CITY_MIN_POP = 40_000
# Одноимённые пункты одного района ближе этого — дубли одного и того же пункта в GeoNames.
DUPLICATE_KM = 2

# admin1-коды GeoNames -> название области.
OBLASTS = {
    "01": "Черкаська обл.", "02": "Чернігівська обл.", "03": "Чернівецька обл.", "04": "Дніпропетровська обл.",
    "05": "Донецька обл.", "06": "Івано-Франківська обл.", "07": "Харківська обл.", "08": "Херсонська обл.",
    "09": "Хмельницька обл.", "10": "Кіровоградська обл.", "11": "Крим", "12": "Київ", "13": "Київська обл.",
    "14": "Луганська обл.", "15": "Львівська обл.", "16": "Миколаївська обл.", "17": "Одеська обл.",
    "18": "Полтавська обл.", "19": "Рівненська обл.", "20": "Севастополь", "21": "Сумська обл.",
    "22": "Тернопільська обл.", "23": "Вінницька обл.", "24": "Волинська обл.", "25": "Закарпатська обл.",
    "26": "Запорізька обл.", "27": "Житомирська обл.",
}

# Районы, у которых в GeoNames нет украинского названия, оно устарело (старые міськради,
# переименования 2024 г.) или с опечаткой: geonameid -> название.
DISTRICT_FIXES = {
    "704383": "Курманський р-н",
    "8449692": "Керченський р-н",
    "9101597": "Лозівський р-н",
    "9114317": "Чугуївський р-н",
    "9194084": "Куп’янський р-н",
    "9287851": "Володимирський р-н",
    "9287853": "Ковельський р-н",
    "9290334": "Стрийський р-н",
    "9290363": "Самбірський р-н",
    "9644965": "Білоцерківський р-н",
    "9806344": "Ніжинський р-н",
    "9806345": "Новгород-Сіверський р-н",
    "9807848": "Шосткинський р-н",
    "9821293": "Миколаївський р-н",
    "12189515": "Шептицький р-н",
    "12189516": "Дрогобицький р-н",
    "12189520": "Луганський р-н",
}

# Части города, заброшенные, исторические, разрушенные и т.п. — не нужны.
SKIP_CODES = {"PPLX", "PPLQ", "PPLH", "PPLW", "PPLF", "PPLCH"}


def pick_names(alt_path):
    """geonameid -> {lang: name}. Предпочитаем «preferred», избегаем исторических и разговорных.
    Берём только кириллицу: в GeoNames под uk часто лежит латинская транслитерация."""
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
                best[key] = (score, APOSTROPHES.sub("’", c[3]))  # один вид апострофа во всех названиях
    names = {}
    for (gid, lang), (_, name) in best.items():
        names.setdefault(gid, {})[lang] = name
    return names


def km(a_lat, a_lon, b_lat, b_lon):
    r = math.radians
    h = math.sin(r(b_lat - a_lat) / 2) ** 2 + math.cos(r(a_lat)) * math.cos(r(b_lat)) * math.sin(r(b_lon - a_lon) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def drop_duplicates(rows):
    """Одноимённые пункты одного района ближе DUPLICATE_KM — оставляем один: крупнейший, затем центр громады/района.
    Громаду не сравниваем: у дублей она часто не заполнена у одной из записей."""
    groups = {}
    for r in rows:
        groups.setdefault((r["uk"], r["a1"], r["a2"]), []).append(r)
    kept = []
    for group in groups.values():
        group.sort(key=lambda r: (-r["pop"], r["code"] == "PPL", int(r["id"])))
        chosen = []
        for r in group:
            if all(km(r["lat"], r["lon"], k["lat"], k["lon"]) >= DUPLICATE_KM for k in chosen):
                chosen.append(r)
        kept += chosen
    return kept, len(rows) - len(kept)


def main(main_path, alt_path, out_path):
    names = pick_names(alt_path)
    regions = list(OBLASTS.values())
    region_idx = {code: i for i, code in enumerate(OBLASTS)}

    districts = []
    district_idx = {}  # (admin1, admin2) -> индекс в districts
    rows = []
    with open(main_path, encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if c[6] == "A" and c[7] == "ADM2":
                uk = DISTRICT_FIXES.get(c[0]) or names.get(c[0], {}).get("uk")
                if uk:  # без украинского названия район не показываем
                    district_idx[(c[10], c[11])] = len(districts)
                    districts.append(re.sub(r"\s+район$", " р-н", uk.strip(), flags=re.I))
                continue
            if c[6] != "P" or c[7] in SKIP_CODES:
                continue
            n = names.get(c[0], {})
            uk = n.get("uk") or n.get("ru")
            if not uk:
                continue  # нет кириллического названия
            rows.append({
                "id": c[0], "uk": uk, "ru": n.get("ru", ""),
                "a1": c[10], "a2": c[11], "code": c[7],
                "lat": round(float(c[4]), 4), "lon": round(float(c[5]), 4), "pop": int(c[14] or 0),
            })

    rows, dropped = drop_duplicates(rows)
    # Крупные пункты первыми — поиск идёт по порядку и берёт первые совпадения.
    rows.sort(key=lambda r: (-r["pop"], int(r["id"])))
    places = [[
        int(r["id"]),
        r["uk"],
        r["ru"] if r["ru"] != r["uk"] else "",
        region_idx.get(r["a1"], -1),
        district_idx.get((r["a1"], r["a2"]), -1),
        r["lat"],
        r["lon"],
        r["pop"],
    ] for r in rows]

    cities = [i for i, p in enumerate(places) if p[7] >= NEAR_CITY_MIN_POP]
    for p in places:
        if p[7] >= NEAR_CITY_MIN_POP:
            p += [-1, 0]
            continue
        j = min(cities, key=lambda k: km(p[5], p[6], places[k][5], places[k][6]))
        p += [j, round(km(p[5], p[6], places[j][5], places[j][6]))]

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"regions": regions, "districts": districts, "places": places}, f, ensure_ascii=False, separators=(",", ":"))
    no_district = sum(1 for p in places if p[4] < 0)
    print(f"{len(places)} пунктов ({dropped} дублей убрано, {no_district} без района), "
          f"{len(districts)} районов, {len(cities)} опорных городов -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
