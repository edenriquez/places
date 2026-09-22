"""Municipios del corredor A (Morelos / Edomex sur). Códigos INEGI verificados contra el DENUE 05/2026.

Centroides = plaza principal de la cabecera (aprox.). Los polígonos se pueden cargar después desde
el Marco Geoestadístico de INEGI; el MVP funciona con centroides.
"""

from __future__ import annotations

from ..db import connect, execute

# cvegeo, cve_ent, cve_mun, estado, nombre, lat, lng, pueblo_magico, desde_cdmx, población aprox (Censo 2020)
CORRIDOR = [
    ("17020", "17", "020", "Morelos", "Tepoztlán", 18.9853, -99.0997, True, "1 h 30", 54987),
    ("17026", "17", "026", "Morelos", "Tlayacapan", 18.9558, -98.9808, True, "1 h 40", 20081),
    ("17029", "17", "029", "Morelos", "Yautepec", 18.8828, -99.0668, False, "1 h 45", 105780),
    ("17006", "17", "006", "Morelos", "Cuautla", 18.8123, -98.9545, False, "1 h 50", 187118),
    ("17022", "17", "022", "Morelos", "Tetela del Volcán", 18.8930, -98.7295, False, "2 h 20", 22309),
    ("17027", "17", "027", "Morelos", "Totolapan", 18.9880, -98.9198, False, "1 h 45", 12447),
    ("17002", "17", "002", "Morelos", "Atlatlahucan", 18.9350, -98.8967, False, "1 h 40", 24029),
    ("17007", "17", "007", "Morelos", "Cuernavaca", 18.9242, -99.2216, False, "1 h 20", 378476),
    ("15052", "15", "052", "Estado de México", "Malinalco", 18.9490, -99.4949, True, "2 h 10", 27482),
    ("15088", "15", "088", "Estado de México", "Tenancingo", 18.9608, -99.5906, False, "2 h 00", 106891),
    ("15063", "15", "063", "Estado de México", "Ocuilan", 18.9790, -99.4166, False, "2 h 00", 34485),
    # Corredor volcanes (Amecameca y alrededores), Estado de México
    ("15009", "15", "009", "Estado de México", "Amecameca", 19.1236, -98.7664, False, "1 h 15", 53441),
    ("15068", "15", "068", "Estado de México", "Ozumba", 19.0392, -98.7936, False, "1 h 25", 30785),
    ("15094", "15", "094", "Estado de México", "Tepetlixpa", 19.0000, -98.8167, False, "1 h 30", 20500),
    ("15017", "15", "017", "Estado de México", "Ayapango", 19.1264, -98.8033, False, "1 h 15", 10053),
    ("15103", "15", "103", "Estado de México", "Tlalmanalco", 19.2044, -98.8025, False, "1 h 10", 47390),
    ("15015", "15", "015", "Estado de México", "Atlautla", 19.0167, -98.7667, False, "1 h 30", 31900),
    ("15034", "15", "034", "Estado de México", "Ecatzingo", 18.9522, -98.7503, False, "1 h 40", 10827),
    ("15050", "15", "050", "Estado de México", "Juchitepec", 19.1000, -98.8792, False, "1 h 10", 27000),
    ("15089", "15", "089", "Estado de México", "Tenango del Aire", 19.1572, -98.8583, False, "1 h 05", 12470),
    ("15022", "15", "022", "Estado de México", "Cocotitlán", 19.2264, -98.8622, False, "1 h 00", 15107),
    ("15083", "15", "083", "Estado de México", "Temamatla", 19.2028, -98.8694, False, "1 h 00", 14130),
]


def seed_municipalities() -> int:
    n = 0
    with connect() as conn:
        for cvegeo, ent, mun, state, name, lat, lng, pm, drive, pop in CORRIDOR:
            n += execute(
                conn,
                """
                insert into public.municipalities
                  (cvegeo, cve_ent, cve_mun, state, name, slug, centroid, is_pueblo_magico, drive_from_cdmx, population)
                values (%s, %s, %s, %s, %s, public.slugify(%s), ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s)
                on conflict (cvegeo) do update set
                  name = excluded.name, state = excluded.state, centroid = excluded.centroid,
                  is_pueblo_magico = excluded.is_pueblo_magico, drive_from_cdmx = excluded.drive_from_cdmx,
                  population = excluded.population
                """,
                (cvegeo, ent, mun, state, name, name, lng, lat, pm, drive, pop),
            )
    return n


CVEGEOS = {row[0] for row in CORRIDOR}
NAME_TO_CVEGEO = {row[4].lower(): row[0] for row in CORRIDOR}
